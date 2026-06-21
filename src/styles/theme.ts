import { createTheme } from '@mui/material/styles';
import { semanticColors } from './colors';

// Dynamic theme creation based on mode
export const createAppTheme = (isDarkMode: boolean = false) => createTheme({
  palette: {
    mode: isDarkMode ? 'dark' : 'light',
    primary: {
      main: semanticColors.primary[500],
      light: semanticColors.primary[300],
      dark: semanticColors.primary[700],
      contrastText: '#ffffff',
    },
    secondary: {
      main: semanticColors.secondary[500],
      light: semanticColors.secondary[300],
      dark: semanticColors.secondary[700],
      contrastText: '#ffffff',
    },
    success: {
      main: semanticColors.success[500],
      light: semanticColors.success[300],
      dark: semanticColors.success[700],
      contrastText: '#ffffff',
    },
    warning: {
      main: semanticColors.warning[500],
      light: semanticColors.warning[300],
      dark: semanticColors.warning[700],
      contrastText: '#ffffff',
    },
    error: {
      main: semanticColors.error[500],
      light: semanticColors.error[300],
      dark: semanticColors.error[700],
      contrastText: '#ffffff',
    },
    background: {
      default: isDarkMode ? '#111110' : '#ffffff',
      paper: isDarkMode ? '#1a1918' : semanticColors.neutral[0],
    },
    text: {
      primary: isDarkMode ? semanticColors.neutral[0] : semanticColors.neutral[900],
      secondary: isDarkMode ? semanticColors.neutral[300] : semanticColors.neutral[600],
      disabled: isDarkMode ? semanticColors.neutral[600] : semanticColors.neutral[400],
    },
    divider: isDarkMode ? semanticColors.neutral[700] : semanticColors.neutral[300],
    action: {
      active: isDarkMode ? semanticColors.neutral[200] : semanticColors.neutral[700],
      hover: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
      selected: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
      disabled: isDarkMode ? 'rgba(255, 255, 255, 0.26)' : 'rgba(0, 0, 0, 0.26)',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontSize: 14,
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 14,
          minHeight: 36,
        },
        containedPrimary: {
          boxShadow: isDarkMode
            ? '0 6px 16px -6px rgba(124, 124, 240, 0.5)'
            : '0 6px 16px -6px rgba(91, 91, 214, 0.45)',
        },
        outlined: {
          borderColor: 'rgba(0,0,0,0.2)',
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: '#f6f7f9',
          '&:hover': { backgroundColor: '#eef0f4' },
          '&:before, &:after': { borderBottom: 'none' },
        },
        input: {
          paddingTop: 14,
          paddingBottom: 14,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: isDarkMode
              ? 'rgba(100, 181, 246, 0.5)'
              : 'rgba(33, 150, 243, 0.5)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: semanticColors.primary[500],
            borderWidth: 2,
          },
        },
        input: {
          padding: '14px 16px',
        },
        inputMultiline: {
          padding: '14px 16px',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          '&.Mui-focused': {
            color: semanticColors.primary[500],
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          fontSize: '12px',
          marginTop: '4px',
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 12 },
      styleOverrides: {
        root: { borderRadius: 16 },
      },
    },
  },
});

// Default light theme for backwards compatibility
export const appTheme = createAppTheme(false);

