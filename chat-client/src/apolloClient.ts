import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client';
import { WebSocketLink } from '@apollo/client/link/ws';
import { getMainDefinition } from '@apollo/client/utilities';

// Enlace para consultas y mutaciones vía HTTP
const httpLink = new HttpLink({
  uri: 'http://localhost:4000/graphql',
});

// Enlace para subscriptions vía WebSocket
const wsLink = new WebSocketLink({
  uri: 'ws://localhost:4000/graphql',
  options: {
    reconnect: true,
    connectionCallback: (error: Error[], result?: any) => {
      if (error && error.length > 0) console.error('WS Connection Error:', error);
    },
  },
});

// Función para direccionar la operación al enlace apropiado
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

export default client;
