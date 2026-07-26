// src/context/MarketplaceContext.tsx

import React, { createContext, useReducer, useContext, ReactNode } from 'react';
import { Product, CartItem, Order } from '../services/marketplaceService';

type State = {
  cart: CartItem[];
  products: Product[];
  analytics: any; // placeholder for analytics data
};

type Action =
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'ADD_TO_CART'; payload: { product: Product; quantity: number } }
  | { type: 'REMOVE_FROM_CART'; payload: { productId: number } }
  | { type: 'UPDATE_CART_QTY'; payload: { productId: number; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_ANALYTICS'; payload: any };

const initialState: State = {
  cart: [],
  products: [],
  analytics: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };
    case 'ADD_TO_CART': {
      const existing = state.cart.find(i => i.product.id === action.payload.product.id);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map(i =>
            i.product.id === action.payload.product.id
              ? { ...i, quantity: i.quantity + action.payload.quantity }
              : i
          ),
        };
      }
      const newItem: CartItem = {
        product: action.payload.product,
        quantity: action.payload.quantity,
      } as any; // cast to any because CartItem type from service may be partial
      return { ...state, cart: [...state.cart, newItem] };
    }
    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter(i => i.product.id !== action.payload.productId) };
    case 'UPDATE_CART_QTY':
      return {
        ...state,
        cart: state.cart.map(i =>
          i.product.id === action.payload.productId ? { ...i, quantity: action.payload.quantity } : i
        ),
      };
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    case 'SET_ANALYTICS':
      return { ...state, analytics: action.payload };
    default:
      return state;
  }
}

type MarketplaceContextProps = {
  state: State;
  dispatch: React.Dispatch<Action>;
};

const MarketplaceContext = createContext<MarketplaceContextProps | undefined>(undefined);

export const MarketplaceProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <MarketplaceContext.Provider value={{ state, dispatch }}>
      {children}
    </MarketplaceContext.Provider>
  );
};

export const useMarketplace = () => {
  const context = useContext(MarketplaceContext);
  if (!context) {
    throw new Error('useMarketplace must be used within a MarketplaceProvider');
  }
  return context;
};
