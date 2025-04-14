import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import client from './apolloClient';
import Chat from './chat';
import './index.css';

// Asegurarse de que el elemento con id "root" existe
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('No se encontró el elemento #root');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <Chat />
    </ApolloProvider>
  </React.StrictMode>
);
