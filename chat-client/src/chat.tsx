import React, { useState, useEffect, useRef } from 'react';
import { gql, useSubscription, useMutation } from '@apollo/client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { ScrollArea } from './components/ui/scroll-area';
import { Avatar, AvatarFallback } from './components/ui/avatar';
import { Separator } from './components/ui/separator';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './components/ui/alert';

// Definiciones GraphQL para la subscription y la mutación
const MESSAGE_ADDED_SUBSCRIPTION = gql`
  subscription {
    messageAdded {
      id
      content
      user
    }
  }
`;

const ADD_MESSAGE_MUTATION = gql`
  mutation AddMessage($content: String!, $user: String!) {
    addMessage(content: $content, user: $user) {
      id
      content
      user
    }
  }
`;

// Interfaz para definir la estructura de un mensaje
interface Message {
  id: string;
  content: string;
  user: string;
  timestamp?: string; // Añadimos timestamp para guardar la hora del mensaje
}

// Función para generar un usuario único para la sesión
const generateUser = (): string => 'User' + Math.floor(Math.random() * 1000);

// Función para obtener iniciales del nombre de usuario
const getInitials = (name: string): string => {
  return name.charAt(0).toUpperCase() + (name.split(/\s+/)[1]?.charAt(0) || '');
};

// Función para generar color basado en nombre de usuario
const getUserColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
};

const Chat: React.FC = () => {
  // Estado para la sesión del usuario
  const [user] = useState<string>(() => generateUser());
  // Estado para acumular mensajes
  const [messagesList, setMessagesList] = useState<Message[]>([]);
  const [message, setMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Hook para la mutación de enviar mensajes
  const [addMessage] = useMutation(ADD_MESSAGE_MUTATION);
  // Hook para la subscription
  const { data, error } = useSubscription(MESSAGE_ADDED_SUBSCRIPTION);

  useEffect(() => {
    if (data && data.messageAdded) {
      // Añadir timestamp cuando se recibe el mensaje
      const messageWithTimestamp = {
        ...data.messageAdded,
        timestamp: new Date().toLocaleTimeString()
      };
      
      setMessagesList((prev) => [...prev, messageWithTimestamp]);
      // Desplazar hacia abajo cuando llegue un nuevo mensaje
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [data]);

  // Función para enviar mensaje usando la sesión del usuario
  const sendMessage = () => {
    if (!message.trim()) return;
    addMessage({ variables: { content: message, user } });
    setMessage('');
  };

  // Manejar el envío con la tecla Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <Card className="shadow-xl">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-xl text-center">Chat en tiempo real</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Error en la subscripción: {error.message}</AlertDescription>
            </Alert>
          )}
          <ScrollArea className="h-[400px] p-4">
            {messagesList.map((msg, index) => (
              <div key={msg.id} className="mb-4">
                <div className="flex items-start gap-3">
                  <Avatar style={{ backgroundColor: getUserColor(msg.user) }}>
                    <AvatarFallback>{getInitials(msg.user)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm">{msg.user}</span>
                      <span className="text-xs text-muted-foreground">
                        {msg.timestamp || 'unknown time'}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{msg.content}</p>
                  </div>
                </div>
                {index < messagesList.length - 1 && (
                  <Separator className="my-4" />
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </ScrollArea>
        </CardContent>
        <CardFooter className="p-4 flex gap-2">
          <Input
            type="text"
            placeholder="Escribe un mensaje..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1"
          />
          <Button onClick={sendMessage} className="whitespace-nowrap">
            Enviar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Chat;
