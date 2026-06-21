/**
 * TopNavBar - Public navigation for unauthenticated users
 *
 * Appears on: LandingPage, HomePage (browse)
 * Public top-nav styling aligned with the project theme system
 * Simple horizontal layout: Logo | Browse | Sign In/User Menu
 */

import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { UserProfileMenu } from './UserProfileMenu';

export function TopNavBar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <Box
      component="nav"
      aria-label="Top navigation"
      sx={{
        bgcolor: 'var(--page-bg)',
        borderBottom: '1px solid var(--page-border)',
        py: 1.5,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          data-testid="top-nav-bar"
        >
          {/* Logo/Brand */}
          <Box
            component="button"
            type="button"
            aria-label="PowerTimeline, go to home"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
              '&:focus-visible': {
                outline: '2px solid var(--page-accent)',
                outlineOffset: '2px',
                borderRadius: '4px',
              },
            }}
            onClick={() => navigate('/')}
            data-testid="logo-button"
          >
            <span className="material-symbols-rounded" style={{ color: 'var(--page-accent)', fontSize: '28px' }}>timeline</span>
            <Typography
              variant="h6"
              component="span"
              sx={{
                color: 'var(--page-text-primary)',
                fontWeight: 700,
                fontSize: '1.2rem',
              }}
            >
              PowerTimeline
            </Typography>
            {/* BETA Indicator */}
            <Box
              sx={{
                bgcolor: 'rgba(91, 91, 214, 0.12)',
                color: '#5b5bd6',
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                ml: 0.5,
              }}
            >
              BETA
            </Box>
          </Box>

          {/* Navigation Links */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              onClick={() => navigate('/browse')}
              data-testid="browse-button"
              sx={{
                color: 'var(--page-text-secondary)',
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 500,
                '&:hover': {
                  color: 'var(--page-text-primary)',
                  bgcolor: 'color-mix(in srgb, var(--page-accent) 10%, transparent)',
                },
              }}
            >
              Browse
            </Button>

            {user ? (
              <Box sx={{
                '& .MuiIconButton-root': {
                  '&:hover': {
                    bgcolor: 'color-mix(in srgb, var(--page-accent) 10%, transparent)',
                  },
                },
                '& .MuiAvatar-root': {
                  bgcolor: 'var(--page-accent)',
                },
                '& span': {
                  color: 'var(--page-text-primary)',
                },
              }}>
                <UserProfileMenu
                  onLogout={() => {
                    localStorage.removeItem('powertimeline_current_user');
                    window.location.href = '/';
                  }}
                />
              </Box>
            ) : (
              <Button
                variant="outlined"
                startIcon={<span className="material-symbols-rounded" style={{ fontSize: '20px' }}>login</span>}
                onClick={() => navigate('/login')}
                data-testid="sign-in-button"
                sx={{
                  borderColor: 'var(--card-border)',
                  color: 'var(--page-text-primary)',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 2,
                  '&:hover': {
                    borderColor: 'var(--page-accent)',
                    bgcolor: 'color-mix(in srgb, var(--page-accent) 10%, transparent)',
                  },
                }}
              >
                Sign In
              </Button>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
