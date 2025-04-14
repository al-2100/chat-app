const { ApolloServer, gql } = require('apollo-server-express');
const { createServer } = require('http');
const express = require('express');
const { execute, subscribe } = require('graphql');
const { SubscriptionServer } = require('subscriptions-transport-ws');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const cors = require('cors');
const EventEmitter = require('events');

// Implementación básica de PubSub
class BasicPubSub {
  constructor() {
    this.ee = new EventEmitter();
    this.subscriptions = {};
    this.subIdCounter = 0;
  }

  publish(triggerName, payload) {
    this.ee.emit(triggerName, payload);
    return true;
  }

  subscribe(triggerName, onMessage) {
    // Retornar el id de forma síncrona
    const id = this.subIdCounter++;
    this.ee.on(triggerName, onMessage);
    this.subscriptions[id] = [triggerName, onMessage];
    return id;
  }

  unsubscribe(subId) {
    // Verificar si la suscripción existe
    if (!(subId in this.subscriptions)) return;
    const [eventName, onMessage] = this.subscriptions[subId];
    this.ee.removeListener(eventName, onMessage);
    delete this.subscriptions[subId];
  }

  asyncIterator(triggers) {
    const triggerArray = Array.isArray(triggers) ? triggers : [triggers];
    return {
      [Symbol.asyncIterator]() {
        const pullQueue = [];
        const pushQueue = [];
        const subscriptionIds = [];

        triggerArray.forEach(triggerName => {
          const listener = (payload) => {
            if (pullQueue.length !== 0) {
              const resolver = pullQueue.shift();
              resolver({ value: payload, done: false });
            } else {
              pushQueue.push(payload);
            }
          };
          const id = pubsub.subscribe(triggerName, listener);
          subscriptionIds.push(id);
        });

        return {
          next() {
            if (pushQueue.length !== 0) {
              const value = pushQueue.shift();
              return Promise.resolve({ value, done: false });
            }
            return new Promise(resolve => {
              pullQueue.push(resolve);
            });
          },
          return() {
            subscriptionIds.forEach(id => pubsub.unsubscribe(id));
            return Promise.resolve({ value: undefined, done: true });
          }
        };
      }
    };
  }
}

const pubsub = new BasicPubSub();

const MESSAGE_ADDED = 'MESSAGE_ADDED';

// Definición del esquema GraphQL
const typeDefs = gql`
  # Tipo Message para representar cada mensaje
  type Message {
    id: ID!
    content: String!
    user: String!
  }

  # Consulta para obtener todos los mensajes
  type Query {
    messages: [Message]
  }

  # Mutación para agregar un nuevo mensaje
  type Mutation {
    addMessage(content: String!, user: String!): Message
  }

  # Subscription que emite cada vez que se agrega un mensaje
  type Subscription {
    messageAdded: Message
  }
`;

// Array en memoria para almacenar los mensajes
let messages = [];

// Resolvers para las operaciones definidas en el esquema
const resolvers = {
  Query: {
    messages: () => messages,
  },
  Mutation: {
    addMessage: (_, { content, user }) => {
      const id = messages.length + 1;
      const message = { id, content, user };
      messages.push(message);
      // Publica el nuevo mensaje para todas las subscripciones
      pubsub.publish(MESSAGE_ADDED, { messageAdded: message });
      return message;
    },
  },
  Subscription: {
    messageAdded: {
      subscribe: () => {
        console.log('Subscribing to new messages');
        return pubsub.asyncIterator(MESSAGE_ADDED);
      },
    },
  },
};

// Inicializar aplicación Express
const app = express();

// Configurar CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Orígenes permitidos
  credentials: true // Habilitar credenciales si es necesario
}));

// Crear un schema ejecutable
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Crear servidor HTTP
const httpServer = createServer(app);

// Configurar servidor de subscripciones
const subscriptionServer = SubscriptionServer.create(
  { 
    schema,
    execute,
    subscribe,
    onConnect: (connectionParams, webSocket, context) => {
      console.log('Cliente conectado a las subscripciones');
      return { pubsub };
    },
    onDisconnect: (webSocket, context) => {
      console.log('Cliente desconectado de las subscripciones');
    }
  },
  { server: httpServer, path: '/graphql' }
);

// Crear la instancia del servidor Apollo
const server = new ApolloServer({
  schema,
  plugins: [{
    async serverWillStart() {
      return {
        async drainServer() {
          subscriptionServer.close();
        }
      };
    }
  }],
  context: ({ req }) => {
    return { pubsub };
  }
});

// Iniciar el servidor
async function startServer() {
  await server.start();
  server.applyMiddleware({ 
    app,
    cors: false
  });
  
  const PORT = 4000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Servidor de chat en tiempo real listo en http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`🚀 Subscriptions disponibles en ws://localhost:${PORT}/graphql`);
  });
}

startServer();
