/**
 * Landing Page - Redesigned v0.5.6
 * Dark theme with gradient effects and timeline-focused messaging
 * Inspired by GitHub, Linear, and modern SaaS best practices
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography, Card, CardContent, Stack, Link } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TimelineIcon from '@mui/icons-material/Timeline';
import GroupIcon from '@mui/icons-material/Group';
import EmailIcon from '@mui/icons-material/Email';
import GitHubIcon from '@mui/icons-material/GitHub';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { TopNavBar } from '../components/TopNavBar';
import { useAuth } from '../contexts/AuthContext';
import { getTimelineMetadata, getUser } from '../services/firestore';
import type { TimelineMetadata, User } from '../types';
import { Helmet } from 'react-helmet-async';
import { landingUrl, OG_IMAGE_URL } from '../utils/urls';
import { organizationSchema } from '../utils/jsonLd';

// Example timeline IDs to display on landing page
const EXAMPLE_TIMELINE_IDS = [
  'timeline-french-revolution',
  'timeline-napoleon',
  'timeline-charles-de-gaulle',
  'timeline-rfk',
];

export function LandingPage() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch example timelines from Firestore to get correct owner IDs
  useEffect(() => {
    async function loadExampleTimelines() {
      try {
        const timelines = await Promise.all(
          EXAMPLE_TIMELINE_IDS.map(id => getTimelineMetadata(id))
        );
        const validTimelines = timelines.filter((t): t is TimelineMetadata => t !== null);
        // Filter to only show public timelines on landing page
        const publicTimelines = validTimelines.filter(
          t => (t.visibility ?? 'public') === 'public'
        );

        // Cache owner usernames for navigation
        const ownerIds = new Set(publicTimelines.map(t => t.ownerId));
        const cache = new Map<string, User>();
        for (const ownerId of ownerIds) {
          const owner = await getUser(ownerId);
          if (owner) {
            cache.set(ownerId, owner);
          }
        }
      } catch (error) {
        console.error('Error loading example timelines:', error);
      }
    }
    loadExampleTimelines();
  }, []);

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not already in an input/textarea
      if (e.key === '/' &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBrowseTimelines = () => {
    navigate('/browse');
  };

  const handleCreateTimeline = () => {
    if (user && userProfile) {
      // Navigate to browse page (could open create dialog in future)
      navigate('/browse');
    } else {
      navigate('/login');
    }
  };

  return (
    <>
      <Helmet>
        <title>PowerTimeline - Visualize History</title>
        <meta name="description" content="Where events become understanding. Create, explore, and visualize timelines. Transform scattered information into shareable, explorable knowledge." />
        <link rel="canonical" href={landingUrl()} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={landingUrl()} />
        <meta property="og:title" content="PowerTimeline - Visualize History" />
        <meta property="og:description" content="Where events become understanding. Create, explore, and visualize timelines." />
        <meta property="og:image" content={OG_IMAGE_URL} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={landingUrl()} />
        <meta name="twitter:title" content="PowerTimeline - Visualize History" />
        <meta name="twitter:description" content="Where events become understanding. Create, explore, and visualize timelines." />
        <meta name="twitter:image" content={OG_IMAGE_URL} />

        {/* JSON-LD */}
        <script type="application/ld+json">{JSON.stringify(organizationSchema())}</script>
      </Helmet>

    {/* Skip to main content link for keyboard accessibility */}
    <a
      href="#main-content"
      style={{
        position: 'absolute',
        left: '-9999px',
        zIndex: 9999,
        padding: '1rem',
        backgroundColor: 'var(--page-bg)',
        color: 'var(--page-accent)',
        textDecoration: 'none',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}
      onFocus={(e) => {
        e.currentTarget.style.left = '1rem';
        e.currentTarget.style.top = '1rem';
      }}
      onBlur={(e) => {
        e.currentTarget.style.left = '-9999px';
        e.currentTarget.style.top = 'auto';
      }}
    >
      Skip to main content
    </a>

    <Box data-testid="landing-page" sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'var(--page-text-primary)', position: 'relative', overflowX: 'hidden' }}>
      {/* Fixed Background - stays while content scrolls */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -2,
          backgroundImage: 'url(/assets/images/PowerTimeline_banner.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {/* Fixed Dark Overlay */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -1,
          background: 'linear-gradient(135deg, rgba(17, 17, 16, 0.88) 0%, rgba(22, 21, 20, 0.92) 100%)',
        }}
      />

      {/* Top Navigation */}
      <TopNavBar />

      {/* Hero Section */}
      <Box
        id="main-content"
        component="main"
        sx={{
          position: 'relative',
          pt: { xs: 10, md: 14 },
          pb: { xs: 8, md: 10 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2 }}>
          {/* Gradient Headline */}
          <Typography
            variant="h1"
            component="h1"
            data-testid="landing-headline"
            gutterBottom
            sx={{
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
              fontWeight: 800,
              lineHeight: 1.1,
              mb: 2,
              background: 'var(--gradient-hero-text)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Where events become understanding
          </Typography>

          {/* Action verbs line */}
          <Typography
            variant="h5"
            component="p"
            sx={{
              mb: 3,
              color: 'var(--page-text-primary)',
              fontSize: { xs: '1.2rem', md: '1.5rem' },
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            Explore. Create. Visualize. Fork. Merge.
          </Typography>

          {/* Purpose statement */}
          <Typography
            variant="h6"
            component="h2"
            sx={{
              mb: 5,
              color: 'var(--page-text-secondary)',
              fontSize: { xs: '1rem', md: '1.15rem' },
              maxWidth: 750,
              mx: 'auto',
              lineHeight: 1.6,
            }}
          >
            Connect the dots between events, people, and decisions.
            Transform scattered information into shareable, explorable knowledge
            that anyone can verify and build upon.
          </Typography>

          {/* CTA Buttons - Explore primary (filled), Sign In secondary (ghost) */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="center"
            sx={{ mb: 6 }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={handleBrowseTimelines}
              data-testid="cta-explore-examples"
              sx={{
                bgcolor: '#5b5bd6',
                color: '#fff',
                fontSize: '1.1rem',
                px: 5,
                py: 1.75,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'var(--shadow-cta-glow)',
                '&:hover': {
                  bgcolor: '#4a4ac8',
                  boxShadow: '0 6px 20px rgba(91, 91, 214, 0.5)',
                },
              }}
            >
              Explore Public Timelines
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={handleCreateTimeline}
              data-testid="cta-get-started"
              sx={{
                borderColor: 'var(--page-border)',
                color: 'var(--page-text-primary)',
                fontSize: '1.1rem',
                px: 5,
                py: 1.75,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': {
                  borderColor: 'var(--page-accent)',
                  bgcolor: 'rgba(91, 91, 214, 0.08)',
                },
              }}
            >
              {user ? 'Create Timeline' : 'Sign In'}
            </Button>
          </Stack>

          {/* Hero Banner - Now used as background, removing inline display */}
          {/* <Box
            sx={{
              mt: 6,
              mx: 'auto',
              maxWidth: 900,
              borderRadius: 3,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
            }}
          >
            <Box
              component="img"
              src="/assets/images/PowerTimeline_banner.png"
              alt="PowerTimeline - Visualize history from ancient civilizations to modern times"
              sx={{
                width: '100%',
                height: 'auto',
                display: 'block',
                borderRadius: 3,
              }}
            />
          </Box> */}
        </Container>
      </Box>

      {/* The Problem Section */}
      <Box sx={{ bgcolor: 'rgba(26, 25, 24, 0.5)', py: 10, borderTop: '1px solid rgba(46, 44, 40, 0.5)', backdropFilter: 'blur(8px)' }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            component="h2"
            textAlign="center"
            sx={{
              mb: 2,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              fontWeight: 700,
              color: 'var(--page-text-primary)',
            }}
          >
            Information is scattered. Context is lost.
          </Typography>
          <Typography
            variant="body1"
            textAlign="center"
            sx={{
              mb: 6,
              color: 'var(--page-text-secondary)',
              fontSize: '1.1rem',
              maxWidth: 700,
              mx: 'auto',
              lineHeight: 1.7,
            }}
          >
            Journalists show private whiteboards. Podcasters explain connections orally.
            Researchers keep notes in silos. Important context lives in people's heads
            instead of being written, linked, and shareable.
          </Typography>
          <Typography
            variant="h5"
            textAlign="center"
            sx={{
              color: 'var(--page-accent)',
              fontWeight: 600,
              fontSize: { xs: '1.1rem', md: '1.3rem' },
            }}
          >
            PowerTimeline makes complex narratives written, explorable, and verifiable.
          </Typography>
        </Container>
      </Box>

      {/* Who It's For Section */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Typography
          variant="h3"
          component="h2"
          textAlign="center"
          sx={{
            mb: 2,
            fontSize: { xs: '2rem', md: '2.5rem' },
            fontWeight: 700,
            color: 'var(--page-text-primary)',
          }}
        >
          Built for people who connect the dots
        </Typography>
        <Typography
          variant="body1"
          textAlign="center"
          sx={{
            mb: 8,
            color: 'var(--page-text-secondary)',
            fontSize: '1.1rem',
            maxWidth: 600,
            mx: 'auto',
          }}
        >
          Whether you're investigating, teaching, or simply trying to understand
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
          {[
            { title: 'Journalists & Investigators', desc: 'Map complex stories with sources. Replace private whiteboards with shareable, linkable evidence.' },
            { title: 'Historians & Researchers', desc: 'Visualize cause and effect across time. Build comprehensive narratives others can fork and improve.' },
            { title: 'Educators & Students', desc: 'Create interactive learning materials. Explore history by zooming from decades to days.' },
            { title: 'Informed Citizens', desc: "Understand what's happening in the world. Connect political events, decisions, and their consequences." },
            { title: 'Podcasters & Content Creators', desc: 'Show your work visually. Let audiences explore the research behind your episodes.' },
            { title: 'Anyone Seeking Clarity', desc: 'When you need to make sense of complexity, timelines reveal patterns that words alone cannot.' },
          ].map((item, index) => (
            <Card
              key={index}
              sx={{
                bgcolor: 'rgba(17, 17, 16, 0.5)',
                border: '1px solid rgba(46, 44, 40, 0.5)',
                borderRadius: 2,
                backdropFilter: 'blur(4px)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: 'var(--page-accent)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'var(--page-text-primary)', fontWeight: 600, fontSize: '1rem' }}>
                  {item.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--page-text-secondary)', lineHeight: 1.6, fontSize: '0.9rem' }}>
                  {item.desc}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>

      {/* Features Section */}
      <Box sx={{ bgcolor: 'rgba(26, 25, 24, 0.5)', py: 10, borderTop: '1px solid rgba(46, 44, 40, 0.5)', backdropFilter: 'blur(8px)' }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            component="h2"
            textAlign="center"
            sx={{
              mb: 2,
              fontSize: { xs: '2rem', md: '2.5rem' },
              fontWeight: 700,
              color: 'var(--page-text-primary)',
            }}
          >
            Tools for serious timeline work
          </Typography>
          <Typography
            variant="body1"
            textAlign="center"
            sx={{
              mb: 8,
              color: 'var(--page-text-secondary)',
              fontSize: '1.1rem',
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            From quick explorations to comprehensive investigations
          </Typography>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
            {/* Feature 1: Timeline Editor — purple top accent */}
            <Card
              sx={{
                flex: 1,
                bgcolor: 'rgba(17, 17, 16, 0.5)',
                border: '1px solid rgba(46, 44, 40, 0.5)',
                borderTop: '3px solid #7c7cf0',
                borderRadius: 2,
                backdropFilter: 'blur(4px)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: '#7c7cf0',
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(124, 124, 240, 0.2)',
                },
              }}
            >
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <TimelineIcon sx={{ fontSize: 56, color: '#7c7cf0', mb: 2 }} />
                <Typography variant="h5" gutterBottom sx={{ color: 'var(--page-text-primary)', fontWeight: 600, mb: 2 }}>
                  Infinite Zoom
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--page-text-secondary)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                  Navigate from centuries to minutes. Smart layout prevents overlap
                  at any scale. See the big picture and the details in one place.
                </Typography>
              </CardContent>
            </Card>

            {/* Feature 2: Collaboration — cyan top accent */}
            <Card
              sx={{
                flex: 1,
                bgcolor: 'rgba(17, 17, 16, 0.5)',
                border: '1px solid rgba(46, 44, 40, 0.5)',
                borderTop: '3px solid #06b6d4',
                borderRadius: 2,
                backdropFilter: 'blur(4px)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: '#06b6d4',
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(6, 182, 212, 0.2)',
                },
              }}
            >
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <GroupIcon sx={{ fontSize: 56, color: '#06b6d4', mb: 2 }} />
                <Typography variant="h5" gutterBottom sx={{ color: 'var(--page-text-primary)', fontWeight: 600, mb: 2 }}>
                  Fork & Improve
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--page-text-secondary)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                  Build on others' work. Fork any public timeline, add your perspective,
                  and contribute back. Collective knowledge grows together.
                </Typography>
              </CardContent>
            </Card>

            {/* Feature 3: Share & Verify — orange top accent */}
            <Card
              sx={{
                flex: 1,
                bgcolor: 'rgba(17, 17, 16, 0.5)',
                border: '1px solid rgba(46, 44, 40, 0.5)',
                borderTop: '3px solid #34d399',
                borderRadius: 2,
                backdropFilter: 'blur(4px)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: '#34d399',
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(52, 211, 153, 0.2)',
                },
              }}
            >
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <SearchIcon sx={{ fontSize: 56, color: '#34d399', mb: 2 }} />
                <Typography variant="h5" gutterBottom sx={{ color: 'var(--page-text-primary)', fontWeight: 600, mb: 2 }}>
                  Share & Verify
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--page-text-secondary)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                  Every event can link to sources. Make your research transparent
                  and let others verify and expand on your work.
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Container>
      </Box>

      {/* Roadmap Section */}
      <Container maxWidth="md" sx={{ py: 10 }}>
        <Typography
          variant="h3"
          component="h2"
          textAlign="center"
          sx={{
            mb: 2,
            fontSize: { xs: '2rem', md: '2.5rem' },
            fontWeight: 700,
            color: 'var(--page-text-primary)',
          }}
        >
          Product Roadmap
        </Typography>
        <Typography
          variant="body1"
          textAlign="center"
          sx={{
            mb: 6,
            color: 'var(--page-text-secondary)',
            fontSize: '1.1rem',
            maxWidth: 600,
            mx: 'auto',
          }}
        >
          Our journey from timeline editor to collaborative knowledge platform
        </Typography>

        {/* Git-style commit visualization */}
        <Box sx={{ position: 'relative', maxWidth: 700, mx: 'auto' }}>
          {/* Vertical line */}
          <Box
            sx={{
              position: 'absolute',
              left: '20px',
              top: '24px',
              bottom: '24px',
              width: '2px',
              bgcolor: '#2e2c28',
            }}
          />

          {/* Roadmap items */}
          <Stack spacing={3}>
            {/* Completed phases */}
            {[
              { version: 'v0.2.x', title: 'Timeline Editor & Layout Engine', desc: 'Infinite zoom, smart card layout, degradation system' },
              { version: 'v0.3.x', title: 'Event Navigation & Authoring', desc: 'Event editor, minimap, interactive highlighting' },
              { version: 'v0.4.x', title: 'Home Page & Timeline Management', desc: 'Discovery feeds, CRUD operations, visibility controls' },
              { version: 'v0.5.0-5.10', title: 'Firebase Authentication & Firestore', desc: 'User accounts, cloud storage, real-time sync' },
              { version: 'v0.5.11-5.20', title: 'Platform Polish & Admin Tools', desc: 'Dark theme, admin panel, statistics, multi-agent orchestration' },
              { version: 'v0.5.21-5.36', title: 'UX Refinements & Branding', desc: 'Stream viewer, import/export, new branding, full-width layouts' },
            ].map((phase, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', position: 'relative', pl: 6 }}>
                {/* Commit dot */}
                <CheckCircleIcon
                  sx={{
                    position: 'absolute',
                    left: '11px',
                    top: '2px',
                    fontSize: 20,
                    color: '#3fb950',
                  }}
                />
                <Box>
                  <Typography
                    variant="body1"
                    sx={{
                      color: 'var(--page-text-primary)',
                      fontWeight: 600,
                      fontSize: '1rem',
                      mb: 0.5,
                    }}
                  >
                    {phase.version} - {phase.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'var(--page-text-secondary)',
                      fontSize: '0.9rem',
                    }}
                  >
                    {phase.desc}
                  </Typography>
                </Box>
              </Box>
            ))}

            {/* Current phase */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', position: 'relative', pl: 6 }}>
              <FiberManualRecordIcon
                sx={{
                  position: 'absolute',
                  left: '11px',
                  top: '2px',
                  fontSize: 20,
                  color: '#5b5bd6',
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                  '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                  },
                }}
              />
              <Box
                sx={{
                  bgcolor: 'rgba(91, 91, 214, 0.08)',
                  border: '1px solid rgba(91, 91, 214, 0.28)',
                  borderRadius: 2,
                  p: 2,
                  flex: 1,
                }}
              >
                <Typography
                  variant="body1"
                  sx={{
                    color: '#5b5bd6',
                    fontWeight: 600,
                    fontSize: '1rem',
                    mb: 0.5,
                  }}
                >
                  v0.5.37+ - Current: User Onboarding Experience
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'var(--page-text-secondary)',
                    fontSize: '0.9rem',
                  }}
                >
                  Empty states, timeline templates, guided tour, first-run experience
                </Typography>
              </Box>
            </Box>

            {/* Upcoming phases */}
            {[
              { version: 'v0.6.x', title: 'Social & Sharing', desc: 'Share links, follows, discovery, activity feeds' },
              { version: 'v0.7.x', title: 'AI Integration', desc: 'Chat interface, timeline Q&A, auto-suggestions, fact-checking' },
              { version: 'v0.8.x', title: 'Rich Media & Archival', desc: 'Image/video uploads, link previews, web page snapshots' },
              { version: 'v0.9.x', title: 'Git-Based Version Control', desc: 'Timeline history, fork/merge workflows, attribution' },
              { version: 'v1.0.0', title: 'Full Platform Launch', desc: 'Complete collaborative knowledge platform with all core features' },
            ].map((phase, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', position: 'relative', pl: 6, opacity: 0.6 }}>
                <RadioButtonUncheckedIcon
                  sx={{
                    position: 'absolute',
                    left: '11px',
                    top: '2px',
                    fontSize: 20,
                    color: '#2e2c28',
                  }}
                />
                <Box>
                  <Typography
                    variant="body1"
                    sx={{
                      color: 'var(--page-text-secondary)',
                      fontWeight: 600,
                      fontSize: '1rem',
                      mb: 0.5,
                    }}
                  >
                    {phase.version} - {phase.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#71717a',
                      fontSize: '0.9rem',
                    }}
                  >
                    {phase.desc}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      </Container>

      {/* Final CTA Section */}
      <Container maxWidth="md" sx={{ py: 12, textAlign: 'center' }}>
        <Typography
          variant="h3"
          sx={{
            mb: 2,
            fontSize: { xs: '2rem', md: '2.5rem' },
            fontWeight: 700,
            color: 'var(--page-text-primary)',
          }}
        >
          Ready to connect the dots?
        </Typography>
        <Typography
          variant="body1"
          sx={{
            mb: 5,
            color: 'var(--page-text-secondary)',
            fontSize: '1.1rem',
            maxWidth: 550,
            mx: 'auto',
            lineHeight: 1.6,
          }}
        >
          Start mapping what matters. Create your first timeline in minutes,
          or explore what others have built.
        </Typography>
        <Box sx={{ textAlign: 'center' }}>
          <Button
            variant="outlined"
            size="large"
            onClick={handleBrowseTimelines}
            sx={{
              borderColor: 'var(--page-border)',
              color: 'var(--page-text-primary)',
              fontSize: '1.1rem',
              px: 5,
              py: 1.75,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': {
                borderColor: 'var(--page-accent)',
                bgcolor: 'rgba(91, 91, 214, 0.08)',
              },
            }}
          >
            View All Timelines
          </Button>
        </Box>
      </Container>

      {/* Footer - Reduced prominence */}
      <Box sx={{ bgcolor: 'rgba(17, 17, 16, 0.8)', borderTop: '1px solid rgba(46, 44, 40, 0.5)', backdropFilter: 'blur(8px)', py: 6 }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={6} sx={{ mb: 4 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'var(--page-text-primary)', fontSize: '1rem', fontWeight: 600 }}>
                PowerTimeline
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--page-text-secondary)', fontSize: '0.9rem' }}>
                Where events become understanding
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'var(--page-text-secondary)', fontSize: '0.85rem', mb: 1.5 }}>
                Product
              </Typography>
              <Stack spacing={0.5}>
                <Button
                  size="small"
                  onClick={handleBrowseTimelines}
                  sx={{
                    color: 'var(--page-text-secondary)',
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    fontSize: '0.85rem',
                    '&:hover': { color: 'var(--page-text-primary)' },
                  }}
                >
                  Browse Timelines
                </Button>
              </Stack>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'var(--page-text-secondary)', fontSize: '0.85rem', mb: 1.5 }}>
                Contact
              </Typography>
              <Stack spacing={1}>
                <Link
                  href="mailto:cynako@gmail.com"
                  underline="none"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: 'var(--page-text-secondary)',
                    fontSize: '0.85rem',
                    '&:hover': { color: 'var(--page-text-primary)' },
                  }}
                >
                  <EmailIcon sx={{ fontSize: 18 }} />
                  cynako@gmail.com
                </Link>
                <Link
                  href="https://github.com/CynaCons/powertimeline"
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="none"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: 'var(--page-text-secondary)',
                    fontSize: '0.85rem',
                    '&:hover': { color: 'var(--page-text-primary)' },
                  }}
                >
                  <GitHubIcon sx={{ fontSize: 18 }} />
                  GitHub Repository
                </Link>
              </Stack>
            </Box>
          </Stack>
          <Typography
            variant="caption"
            sx={{
              color: '#71717a',
              textAlign: 'center',
              display: 'block',
              fontSize: '0.8rem',
              pt: 3,
              borderTop: '1px solid #2e2c28',
            }}
          >
            © 2025 PowerTimeline. Built for people who connect the dots.
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#484f58',
              textAlign: 'center',
              display: 'block',
              fontSize: '0.75rem',
              mt: 1,
            }}
          >
            Built with{' '}
            <Link
              href="https://github.com/CynaCons/PowerSpawn"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: '#71717a', '&:hover': { color: 'var(--page-accent)' } }}
            >
              PowerSpawn
            </Link>
            {' '}— AI-powered multi-agent orchestration
          </Typography>
        </Container>
      </Box>
    </Box>
    </>
  );
}
