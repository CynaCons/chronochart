import React from 'react';
import type { PositionedCard, CardType } from './types';
import type { Event } from '../types';
import { getEventIcon } from './cardIcons';

type SessionDecision = 'pending' | 'accepted' | 'rejected';

interface CardRendererProps {
  card: PositionedCard;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: (card: PositionedCard) => void;
  onDoubleClick?: (card: PositionedCard) => void;
  isFirstCard?: boolean;
  sessionDecision?: SessionDecision;
}

export function CardRenderer({
  card,
  isSelected = false,
  isHovered = false,
  onClick,
  onDoubleClick,
  isFirstCard = false,
  sessionDecision
}: CardRendererProps) {
  // SRS_DB.md compliant - category field removed, use default gradient
  const gradientClass = getGradientClass(card.cardType);
  const elevationClass = getElevationClass(card.cardType, isSelected, isHovered);
  const sessionDecisionClass = sessionDecision ? `session-event-${sessionDecision}` : '';
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(card);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(card);
  };

  // Get the event date for data attribute
  const eventDate = card.event.date;
  const isPreview = card.event.isPreview === true;

  return (
    <div
      data-testid="event-card"
      data-event-id={card.id}
      data-event-date={eventDate}
      data-card-type={card.cardType}
      data-cluster-id={card.clusterId}
      data-density={card.cardType}
      data-tour={isFirstCard ? 'event-card' : undefined}
      data-preview={isPreview || undefined}
      role="button"
      aria-label={`Event: ${card.event.title} on ${eventDate}`}
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      className={`
        absolute cursor-pointer card-hover-scale card-enter
        ${getCardTypeStyles(card.cardType)}
        ${gradientClass}
        ${elevationClass}
        ${isSelected ? 'card-selected' : ''}
        ${isPreview ? 'card-preview' : ''}
        ${sessionDecisionClass}
      `}
      style={{
        left: card.x - card.width / 2,
        top: card.y,
        width: card.width,
        height: card.height,
        zIndex: isSelected ? 20 : (isHovered ? 15 : 10)
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {renderCardContent(card, sessionDecision)}
    </div>
  );
}

function getCardTypeStyles(cardType: CardType): string {
  const baseStyles = 'border rounded-lg overflow-hidden transition-theme';

  switch (cardType) {
    case 'full':
      return `${baseStyles} border-primary p-4`;
    case 'compact':
      return `${baseStyles} border-primary p-3`;
    case 'title-only':
      return `${baseStyles} border-primary p-2`;
    default:
      return baseStyles;
  }
}

function getGradientClass(cardType: CardType, category?: string): string {
  if (category && ['milestone', 'meeting', 'deadline', 'launch', 'announcement'].includes(category)) {
    return `card-gradient-${category}`;
  }

  switch (cardType) {
    default:
      return 'card-gradient-default';
  }
}

function getElevationClass(cardType: CardType, isSelected: boolean, isHovered: boolean): string {
  if (isSelected) return 'card-elevation-3';
  if (isHovered) return 'card-elevation-2';

  switch (cardType) {
    default:
      return 'card-elevation-1';
  }
}

function renderCardContent(card: PositionedCard, sessionDecision?: SessionDecision): React.ReactNode {
  const event = card.event;
  
  switch (card.cardType) {
    case 'full':
      return <FullCardContent event={event} sessionDecision={sessionDecision} />;
    case 'compact':
      return <CompactCardContent event={event} sessionDecision={sessionDecision} />;
    case 'title-only':
      return <TitleOnlyCardContent event={event} sessionDecision={sessionDecision} />;
    default:
      return <FullCardContent event={event} sessionDecision={sessionDecision} />;
  }
}

// Source indicator for events with sources (CC-REQ-CARD-SOURCE-001)
// Subtle, theme-aware icon that blends with card content
function SourceIndicator({ sources }: { sources?: string[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <span
      data-testid="source-indicator"
      data-source-count={sources.length}
      className="material-symbols-rounded flex-shrink-0"
      style={{
        fontSize: '14px',
        color: 'var(--color-text-tertiary)',
        opacity: 0.6,
      }}
      title={`${sources.length} source${sources.length > 1 ? 's' : ''}`}
    >
      link
    </span>
  );
}

function FullCardContent({ event, sessionDecision }: { event: Event; sessionDecision?: SessionDecision }) {
  const eventIcon = getEventIcon(event);
  const sessionBadge = getSessionBadge(sessionDecision);

  return (
    <div className="card-body h-full flex flex-col overflow-hidden">
      <div className="flex items-start gap-1 flex-shrink-0">
        <h3 className="card-title card-clamp-title-2 flex-1 min-w-0" style={{ color: 'var(--color-text-primary)' }} title={event.title}>
          {event.title}
        </h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          {sessionBadge}
          <SourceIndicator sources={event.sources} />
          <span
            className="card-icon material-symbols-rounded"
            style={{ color: eventIcon.color, fontSize: '0.875rem' }}
            title={eventIcon.description}
          >
            {eventIcon.icon}
          </span>
        </div>
      </div>
      <p className="card-description card-clamp-desc-3 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-text-secondary)' }} title={event.description}>
        {event.description}
      </p>
      <div className="card-date flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
        {formatDate(event.date)}
      </div>
    </div>
  );
}

function CompactCardContent({ event, sessionDecision }: { event: Event; sessionDecision?: SessionDecision }) {
  const eventIcon = getEventIcon(event);
  const sessionBadge = getSessionBadge(sessionDecision);

  return (
    <div className="card-body h-full flex flex-col overflow-hidden">
      <div className="flex items-start gap-1 flex-shrink-0">
        <h3 className="card-title card-clamp-title-2 flex-1 min-w-0" style={{ color: 'var(--color-text-primary)' }} title={event.title}>
          {event.title}
        </h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          {sessionBadge}
          <SourceIndicator sources={event.sources} />
          <span
            className="card-icon material-symbols-rounded flex-shrink-0"
            style={{ color: eventIcon.color, fontSize: '0.75rem' }}
            title={eventIcon.description}
          >
            {eventIcon.icon}
          </span>
        </div>
      </div>
      <p className="card-description card-clamp-desc-1 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-text-secondary)' }} title={event.description}>
        {event.description}
      </p>
      <div className="card-date flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
        {formatDate(event.date)}
      </div>
    </div>
  );
}

function TitleOnlyCardContent({ event, sessionDecision }: { event: Event; sessionDecision?: SessionDecision }) {
  const eventIcon = getEventIcon(event);
  const sessionBadge = getSessionBadge(sessionDecision);

  return (
    <div className="h-full flex items-center justify-between">
      <h3 className="card-title card-clamp-title-1 flex-1 min-w-0" style={{ color: 'var(--color-text-primary)' }} title={event.title}>
        {event.title}
      </h3>
      <div className="flex items-center gap-1">
        {sessionBadge}
        <SourceIndicator sources={event.sources} />
        <span
          className="card-icon material-symbols-rounded flex-shrink-0"
          style={{ color: eventIcon.color, fontSize: '0.75rem' }}
          title={eventIcon.description}
        >
          {eventIcon.icon}
        </span>
      </div>
    </div>
  );
}

function getSessionBadge(sessionDecision?: SessionDecision): React.ReactNode {
  if (!sessionDecision || sessionDecision === 'rejected') {
    return null;
  }

  const label = sessionDecision === 'pending' ? 'Pending' : 'Accepted';
  const colorClass = sessionDecision === 'pending' ? 'text-orange-400 border-orange-400' : 'text-green-400 border-green-400';

  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${colorClass}`}>
      {label}
    </span>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
