// src/theme/marketplace.ts

export const marketplaceColors = {
  primary: 'hsl(210, 70%, 55%)', // vibrant blue
  secondary: 'hsl(340, 65%, 55%)', // accent pink
  background: 'hsl(0, 0%, 5%)', // dark mode bg
  card: 'hsla(0, 0%, 100%, 0.08)', // glass effect
  textPrimary: 'hsl(0, 0%, 95%)',
  textSecondary: 'hsl(0, 0%, 70%)',
};

export const marketplaceTypography = {
  fontFamily: 'Inter',
  h1: {
    fontSize: 28,
    fontWeight: '700',
    color: 'hsl(0, 0%, 95%)',
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: 'hsl(0, 0%, 90%)',
  },
};

export const marketplaceShadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
};
