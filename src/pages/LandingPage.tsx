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
          background: 'var(--page-bg)',
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
          background: 'radial-gradient(110% 70% at 50% 0%, rgba(91, 91, 214, 0.07) 0%, rgba(124, 124, 240, 0.025) 40%, transparent 72%)',
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
              color: 'var(--page-text-primary)',
              letterSpacing: '-0.02em',
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
      <Box sx={{ bgcolor: 'var(--page-bg-elevated)', py: 10, borderTop: '1px solid var(--page-border)' }}>
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
            { title: 'Journalists & Investigators', icon: 'newspaper', desc: 'Map complex stories with sources. Replace private whiteboards with shareable, linkable evidence.' },
            { title: 'Historians & Researchers', icon: 'history_edu', desc: 'Visualize cause and effect across time. Build comprehensive narratives others can fork and improve.' },
            { title: 'Educators & Students', icon: 'school', desc: 'Create interactive learning materials. Explore history by zooming from decades to days.' },
            { title: 'Informed Citizens', icon: 'public', desc: "Understand what's happening in the world. Connect political events, decisions, and their consequences." },
            { title: 'Podcasters & Content Creators', icon: 'podcasts', desc: 'Show your work visually. Let audiences explore the research behind your episodes.' },
            { title: 'Anyone Seeking Clarity', icon: 'insights', desc: 'When you need to make sense of complexity, timelines reveal patterns that words alone cannot.' },
          ].map((item, index) => (
            <Card
              key={index}
              sx={{
                bgcolor: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'var(--page-accent)',
                  transform: 'translateY(-3px)',
                  boxShadow: '0 18px 36px -22px rgba(20,30,60,0.35)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2.5,
                    bgcolor: 'rgba(91, 91, 214, 0.10)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 1.75,
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '24px', color: '#5b5bd6' }}>
                    {item.icon}
                  </span>
                </Box>
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
      <Box sx={{ bgcolor: 'var(--page-bg-elevated)', py: 10, borderTop: '1px solid var(--page-border)' }}>
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
                bgcolor: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
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
                bgcolor: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
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
                bgcolor: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
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
          Everything you need, already here
        </Typography>
        <Typography
          variant="body1"
          textAlign="center"
          sx={{
            mb: 6,
            color: 'var(--page-text-secondary)',
            fontSize: '1.1rem',
            maxWidth: 640,
            mx: 'auto',
          }}
        >
          A complete toolkit for building, exploring, and sharing source-linked timelines.
        </Typography>

        {/* What's here today */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2.5, mb: 8 }}>
          {[
            { icon: 'timeline', title: 'Visual timeline builder', desc: 'Infinite-zoom canvas, from centuries to a single day.' },
            { icon: 'smart_toy', title: 'AI assistant', desc: 'Draft and expand timelines with an AI that cites sources.' },
            { icon: 'link', title: 'Source-linked events', desc: 'Every event can carry its sources for verification.' },
            { icon: 'view_stream', title: 'Readable Stream view', desc: 'A clean chronological reading mode for any timeline.' },
            { icon: 'share', title: 'Sharing & embeds', desc: 'Share a link or embed a timeline anywhere.' },
            { icon: 'sync_alt', title: 'Import & export', desc: 'Move timelines in and out as portable YAML.' },
            { icon: 'bolt', title: 'Live current events', desc: 'Rolling, continuously-updated timelines like the Iran War.' },
            { icon: 'api', title: 'Automation API', desc: 'Add events programmatically via a token-auth REST API.' },
          ].map((f, i) => (
            <Box
              key={i}
              sx={{
                bgcolor: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: 2.5,
                p: 2.5,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'var(--page-accent)',
                  transform: 'translateY(-3px)',
                  boxShadow: '0 18px 36px -22px rgba(20,30,60,0.35)',
                },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: 'rgba(91, 91, 214, 0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1.5,
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '22px', color: '#5b5bd6' }}>
                  {f.icon}
                </span>
              </Box>
              <Typography variant="subtitle1" sx={{ color: 'var(--page-text-primary)', fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>
                {f.title}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--page-text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                {f.desc}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Coming next */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="overline" sx={{ color: 'var(--page-accent)', fontWeight: 700, letterSpacing: '0.08em' }}>
            Coming next
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ mt: 2 }}>
            {[
              { icon: 'account_tree', label: 'Version history & fork / merge' },
              { icon: 'image', label: 'Rich media & link previews' },
              { icon: 'travel_explore', label: 'Better discovery & follows' },
            ].map((c, i) => (
              <Box
                key={i}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: 'var(--page-bg-elevated)',
                  border: '1px solid var(--page-border)',
                  borderRadius: 999,
                  px: 2,
                  py: 1,
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--page-text-secondary)' }}>
                  {c.icon}
                </span>
                <Typography variant="body2" sx={{ color: 'var(--page-text-secondary)', fontWeight: 500 }}>
                  {c.label}
                </Typography>
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
      <Box sx={{ bgcolor: 'var(--page-bg-elevated)', borderTop: '1px solid var(--page-border)', py: 6 }}>
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
              <Stack spacing={0.5} alignItems="flex-start">
                <Button
                  size="small"
                  onClick={handleBrowseTimelines}
                  sx={{
                    color: 'var(--page-text-secondary)',
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    fontSize: '0.85rem',
                    minWidth: 0,
                    px: 0,
                    '&:hover': { color: 'var(--page-text-primary)', background: 'transparent' },
                  }}
                >
                  Browse Timelines
                </Button>
                <Button
                  size="small"
                  onClick={handleCreateTimeline}
                  sx={{
                    color: 'var(--page-text-secondary)',
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    fontSize: '0.85rem',
                    minWidth: 0,
                    px: 0,
                    '&:hover': { color: 'var(--page-text-primary)', background: 'transparent' },
                  }}
                >
                  {user ? 'Create a timeline' : 'Sign in'}
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
                  Email us
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
              borderTop: '1px solid var(--page-border)',
            }}
          >
            © {new Date().getFullYear()} PowerTimeline. Built for people who connect the dots.
          </Typography>
        </Container>
      </Box>
    </Box>
    </>
  );
}
