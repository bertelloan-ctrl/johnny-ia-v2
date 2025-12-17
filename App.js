import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import VendedorScreen from './screens/VendedorScreen';
import TestCallScreen from './screens/TestCallScreen';
import ClientConfigScreen from './screens/ClientConfigScreen';
import DashboardScreen from './screens/DashboardScreen';
import LeadsScreen from './screens/LeadsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
        />
        <Stack.Screen
          name="Vendedor"
          component={VendedorScreen}
        />
        <Stack.Screen
          name="ClientConfig"
          component={ClientConfigScreen}
          options={{
            headerShown: true,
            title: 'Configurar Cliente',
            headerStyle: {
              backgroundColor: '#10b981',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <Stack.Screen
          name="TestVendor"
          component={TestCallScreen}
          options={{
            headerShown: true,
            title: 'Prueba de Vendedor IA',
            headerStyle: {
              backgroundColor: '#16213e',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            headerShown: true,
            title: 'Dashboard',
            headerStyle: {
              backgroundColor: '#3b82f6',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <Stack.Screen
          name="Leads"
          component={LeadsScreen}
          options={{
            headerShown: true,
            title: 'Gestión de Leads',
            headerStyle: {
              backgroundColor: '#8b5cf6',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
