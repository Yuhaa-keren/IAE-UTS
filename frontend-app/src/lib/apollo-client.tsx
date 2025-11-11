// frontend-app/src/lib/apollo-client.tsx
'use client';

import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/ws';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

// 1. Link HTTP (untuk queries dan mutations)
const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_API_GATEWAY_URL + '/graphql' || 'http://localhost:3000/graphql',
});

// 2. Link WebSocket (untuk subscriptions)
// Kita harus ganti http:// dengan ws://
const wsUrl = (process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000')
  .replace(/^http/, 'ws') + '/graphql';

const wsLink = new GraphQLWsLink(createClient({
  url: wsUrl,
  connectionParams: () => {
    // Kita juga bisa mengirim token via koneksi websocket
    const token = localStorage.getItem('token');
    return {
      Authorization: token ? `Bearer ${token}` : '',
    };
  },
}));

// 3. Link Autentikasi (untuk menambahkan token ke header HTTP)
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
});

// 4. "Split" Link
// Ini akan mengarahkan request ke link yang benar
// 'wsLink' untuk subscriptions, 'authLink.concat(httpLink)' untuk lainnya
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink, // <-- Jika subscription
  authLink.concat(httpLink) // <-- Jika query atau mutation
);

// 5. Buat Client
const client = new ApolloClient({
  link: splitLink, // Gunakan splitLink yang baru
  cache: new InMemoryCache(),
});

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}