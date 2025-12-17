import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import VendedorScreen from './screens/VendedorScreen';
import TestCallScreen from './screens/TestCallScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Vendedor"
        screenOptions={{
          headerShown: false
        }}
      >
        <Stack.Screen
          name="Vendedor"
          component={VendedorScreen}
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
