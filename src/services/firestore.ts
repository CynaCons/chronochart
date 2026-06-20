import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  increment,
  serverTimestamp,
  collectionGroup,
  writeBatch,
  startAfter,
  runTransaction,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  Timeline,
  TimelineMetadata,
  Event,
  EventDocument,
  User,
  AdminActivityLog,
  TimelineVisibility
} from '../types';

// Collection names
const COLLECTIONS = {
  TIMELINES: 'timelines', // Now a subcollection under users
  EVENTS: 'events', // Subcollection under timelines
  USERS: 'users',
  ACTIVITY_LOGS: 'activityLogs',
  STATS: 'stats', // Platform-level statistics
} as const;

// Stats document IDs
const STATS_DOCS = {
  PLATFORM: 'platform',
} as const;

// Stats caching configuration
const STATS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let statsCache: { data: PlatformStats | null; timestamp: number } = { data: null, timestamp: 0 };

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Convert Firebase/Firestore errors into user-friendly messages
 * v0.7.8 - Improved error messages with actionable guidance
 */
export function getFirestoreErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('permission-denied')) {
      return 'You do not have permission to perform this action.';
    }
    if (error.message.includes('unavailable')) {
      return 'Service temporarily unavailable. Please try again.';
    }
    if (error.message.includes('not-found')) {
      return 'The requested resource was not found.';
    }
    if (error.message.includes('network-request-failed') || error.message.includes('offline')) {
      return 'Network connection lost. Please check your internet connection and try again.';
    }
  }
  return 'An unexpected error occurred. Please try again.';
}

// Platform stats interface
interface PlatformStats {
  totalUsers: number;
  totalTimelines: number;
  totalEvents: number;
  totalViews: number;
  publicTimelines: number;
  unlistedTimelines: number;
  privateTimelines: number;
  lastUpdated: string;
}

// ============================================================================
// Timeline Operations
// ============================================================================

/**
 * Get timeline metadata only (without events)
 * v0.5.0.1 - Event Persistence Optimization
 */
export async function getTimelineMetadata(timelineId: string): Promise<TimelineMetadata | null> {
  try {
    // First try: query by 'id' field (works for newer documents that store id as a field)
    let q = query(
      collectionGroup(db, COLLECTIONS.TIMELINES),
      where('id', '==', timelineId),
      limit(1)
    );
    let querySnapshot = await getDocs(q);

    // If not found by id field, try a broader search
    // This handles legacy documents where id isn't stored as a field
    if (querySnapshot.empty) {
      console.warn(`[getTimelineMetadata] Fallback triggered for timeline ${timelineId} - 'id' field not found`);
      // Query recent timelines and find by doc.id (limited to avoid scanning too many)
      q = query(
        collectionGroup(db, COLLECTIONS.TIMELINES),
        orderBy('updatedAt', 'desc'),
        limit(50)
      );
      querySnapshot = await getDocs(q);

      // Find the matching document by doc.id
      const matchingDoc = querySnapshot.docs.find(d => d.id === timelineId);
      if (matchingDoc) {
        const data = matchingDoc.data();
        // Extract ownerId from path if not in data: /users/{ownerId}/timelines/{timelineId}
        const ownerId = data.ownerId || matchingDoc.ref.parent.parent?.id;
        const metadata = { ...data, id: matchingDoc.id, ownerId } as TimelineMetadata;
        return metadata;
      }

      return null;
    }

    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();
    // Extract ownerId from path if not in data
    const ownerId = data.ownerId || docSnap.ref.parent.parent?.id;
    const metadata = { ...data, id: docSnap.id, ownerId } as TimelineMetadata;
    return metadata;
  } catch (error) {
    console.error('[getTimelineMetadata] Error:', error);
    throw error;
  }
}

/**
 * Get a timeline by ID with all events (searches across all users' timelines)
 */
export async function getTimeline(timelineId: string): Promise<Timeline | null> {
  try {
    // First get the metadata
    const metadata = await getTimelineMetadata(timelineId);
    if (!metadata) {
      return null;
    }

    // Then get all events
    const events = await getTimelineEvents(timelineId, metadata.ownerId);

    return {
      ...metadata,
      events,
    };
  } catch (error) {
    console.error('Error fetching timeline:', error);
    throw error;
  }
}

/**
 * Get all timelines metadata (without events)
 * If ownerId is provided, queries that specific user's timelines subcollection
 * Otherwise, uses collectionGroup to query across all users
 * v0.5.0.1 - Event Persistence Optimization - Now returns metadata only
 */
export async function getTimelines(options?: {
  ownerId?: string;
  visibility?: TimelineVisibility;
  featured?: boolean;
  limitCount?: number;
  orderByField?: 'createdAt' | 'updatedAt' | 'viewCount';
  orderDirection?: 'asc' | 'desc';
}): Promise<TimelineMetadata[]> {
  try {
    const constraints: QueryConstraint[] = [];

    // Note: when using collection group, ownerId filter is applied via where clause
    if (options?.ownerId) {
      constraints.push(where('ownerId', '==', options.ownerId));
    }

    if (options?.visibility) {
      constraints.push(where('visibility', '==', options.visibility));
    }

    if (options?.featured !== undefined) {
      constraints.push(where('featured', '==', options.featured));
    }

    if (options?.orderByField) {
      constraints.push(orderBy(options.orderByField, options.orderDirection || 'desc'));
    } else {
      constraints.push(orderBy('updatedAt', 'desc'));
    }

    if (options?.limitCount) {
      constraints.push(limit(options.limitCount));
    }

    // Use collection group to query across all users' timeline subcollections
    const q = query(collectionGroup(db, COLLECTIONS.TIMELINES), ...constraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Extract ownerId from document path if not in data
      // Path: /users/{ownerId}/timelines/{timelineId}
      const ownerId = data.ownerId || doc.ref.parent.parent?.id;
      return {
        id: doc.id,
        ...data,
        ownerId,
      };
    }) as TimelineMetadata[];
  } catch (error) {
    console.error('Error fetching timelines:', error);
    throw error;
  }
}

export type TimelinePageCursor = QueryDocumentSnapshot;

/**
 * Get a single page of timelines for a specific user using startAfter for pagination
 */
export async function getUserTimelinesPage(options: {
  ownerId: string;
  limitCount: number;
  orderByField?: 'createdAt' | 'updatedAt' | 'viewCount';
  orderDirection?: 'asc' | 'desc';
  startAfterDoc?: TimelinePageCursor | null;
}): Promise<{ timelines: TimelineMetadata[]; cursor: TimelinePageCursor | null }> {
  try {
    const constraints: QueryConstraint[] = [
      orderBy(options.orderByField || 'updatedAt', options.orderDirection || 'desc'),
      limit(options.limitCount),
    ];

    if (options.startAfterDoc) {
      constraints.push(startAfter(options.startAfterDoc));
    }

    const timelinesCollectionRef = collection(
      db,
      COLLECTIONS.USERS,
      options.ownerId,
      COLLECTIONS.TIMELINES
    );
    const q = query(timelinesCollectionRef, ...constraints);
    const querySnapshot = await getDocs(q);

    const timelines = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      ownerId: options.ownerId,
    })) as TimelineMetadata[];

    const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

    return { timelines, cursor: lastDoc };
  } catch (error) {
    console.error('Error fetching paginated timelines:', error);
    throw error;
  }
}

// ============================================================================
// Event Operations
// ============================================================================

/**
 * Get all events for a timeline
 * v0.5.0.1 - Event Persistence Optimization
 */
export async function getTimelineEvents(timelineId: string, ownerId: string): Promise<Event[]> {
  try {
    const eventsCollectionRef = collection(
      db,
      COLLECTIONS.USERS,
      ownerId,
      COLLECTIONS.TIMELINES,
      timelineId,
      COLLECTIONS.EVENTS
    );

    // Order by date since 'order' field may not exist on all events
    const q = query(eventsCollectionRef, orderBy('date', 'asc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const eventDoc = doc.data() as EventDocument;
      // Convert EventDocument back to Event by removing Firestore-specific fields
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { timelineId, createdAt, updatedAt, ...event } = eventDoc;
      // Ensure event has the document ID (doc.data() doesn't include it)
      return { ...event, id: doc.id } as Event;
    });
  } catch (error) {
    console.error('[getTimelineEvents] Error:', error);
    throw error;
  }
}

/**
 * Add a new event to a timeline
 * v0.5.0.1 - Event Persistence Optimization
 */
export async function addEvent(
  timelineId: string,
  ownerId: string,
  event: Event
): Promise<void> {
  try {
    const eventsCollectionRef = collection(
      db,
      COLLECTIONS.USERS,
      ownerId,
      COLLECTIONS.TIMELINES,
      timelineId,
      COLLECTIONS.EVENTS
    );

    const eventRef = doc(eventsCollectionRef, event.id);
    const now = new Date().toISOString();

    // SRS_DB.md compliant - no order field, events sorted by date
    const eventDoc: EventDocument = {
      ...event,
      timelineId,
      createdAt: now,
      updatedAt: now,
    };

    // Firestore rejects `undefined` field values. Optional fields left blank
    // (e.g. `time` when the user doesn't set a time) arrive as undefined — strip
    // them so the event can be created without a time.
    const sanitizedEventDoc = Object.fromEntries(
      Object.entries(eventDoc).filter(([, value]) => value !== undefined)
    ) as EventDocument;

    await setDoc(eventRef, sanitizedEventDoc);

    // Update timeline's eventCount and updatedAt atomically using increment
    const timelineRef = doc(db, COLLECTIONS.USERS, ownerId, COLLECTIONS.TIMELINES, timelineId);
    await updateDoc(timelineRef, {
      eventCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding event:', error);
    throw error;
  }
}

/**
 * Update an existing event
 * v0.5.0.1 - Event Persistence Optimization
 */
export async function updateEvent(
  timelineId: string,
  ownerId: string,
  eventId: string,
  updates: Partial<Event>
): Promise<void> {
  try {
    const eventRef = doc(
      db,
      COLLECTIONS.USERS,
      ownerId,
      COLLECTIONS.TIMELINES,
      timelineId,
      COLLECTIONS.EVENTS,
      eventId
    );

    const now = new Date().toISOString();

    await updateDoc(eventRef, {
      ...updates,
      updatedAt: now,
    });

    // Update timeline's updatedAt
    const timelineRef = doc(db, COLLECTIONS.USERS, ownerId, COLLECTIONS.TIMELINES, timelineId);
    await updateDoc(timelineRef, {
      updatedAt: now,
    });
  } catch (error) {
    console.error('Error updating event:', error);
    throw error;
  }
}

/**
 * Delete an event from a timeline
 * v0.5.0.1 - Event Persistence Optimization
 */
export async function deleteEvent(
  timelineId: string,
  ownerId: string,
  eventId: string
): Promise<void> {
  try {
    const eventRef = doc(
      db,
      COLLECTIONS.USERS,
      ownerId,
      COLLECTIONS.TIMELINES,
      timelineId,
      COLLECTIONS.EVENTS,
      eventId
    );

    await deleteDoc(eventRef);

    // Update timeline's eventCount and updatedAt atomically using increment
    const timelineRef = doc(db, COLLECTIONS.USERS, ownerId, COLLECTIONS.TIMELINES, timelineId);
    await updateDoc(timelineRef, {
      eventCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
}

/**
 * Create a new timeline in the user's timelines subcollection
 * @param timeline - Timeline data (must include ownerId, can include events for backward compatibility)
 * @param customId - Optional custom ID (e.g., "timeline-french-revolution"). If not provided, auto-generates ID.
 * v0.5.0.1 - Event Persistence Optimization - Now stores events in subcollection
 */
export async function createTimeline(
  timeline: Omit<Timeline, 'id' | 'createdAt' | 'updatedAt' | 'ownerUsername'> | Omit<TimelineMetadata, 'id' | 'createdAt' | 'updatedAt' | 'ownerUsername'>,
  customId?: string
): Promise<string> {
  try {
    // Timeline must have an ownerId
    if (!timeline.ownerId) {
      throw new Error('Timeline must have an ownerId');
    }

    // v0.8.11 - Get owner's username for denormalization
    const owner = await getUser(timeline.ownerId);
    if (!owner) {
      throw new Error('Owner not found');
    }

    // Get reference to user's timelines subcollection
    const timelinesCollectionRef = collection(db, COLLECTIONS.USERS, timeline.ownerId, COLLECTIONS.TIMELINES);
    const timelineId = customId || doc(timelinesCollectionRef).id;
    const timelineRef = doc(db, COLLECTIONS.USERS, timeline.ownerId, COLLECTIONS.TIMELINES, timelineId);
    const now = new Date().toISOString();

    // Extract events if present (backward compatibility)
    const events = 'events' in timeline ? timeline.events : [];
    // Remove events property if present (TypeScript-safe destructuring)
    const timelineData: Omit<typeof timeline, 'events'> = 'events' in timeline
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ? (({ events: _eventsToOmit, ...rest }) => rest)(timeline)
      : timeline;

    const newTimeline: TimelineMetadata = {
      ...timelineData,
      id: timelineId,
      ownerUsername: owner.username,  // v0.8.11 - Denormalized username
      createdAt: now,
      updatedAt: now,
      viewCount: timeline.viewCount || 0,
      featured: timeline.featured || false,
      eventCount: events.length,
    };

    await runTransaction(db, async (transaction) => {
      const existingTimeline = await transaction.get(timelineRef);

      if (existingTimeline.exists()) {
        throw new Error('This timeline ID is already in use.');
      }

      transaction.set(timelineRef, newTimeline);
    });

    // If events were provided, add them to the subcollection
    if (events.length > 0) {
      for (let i = 0; i < events.length; i++) {
        await addEvent(timelineId, timeline.ownerId, events[i]);
      }
    }

    // v0.5.17 - Invalidate stats cache when timeline is created
    invalidateStatsCache();

    return timelineId;
  } catch (error) {
    console.error('Error creating timeline:', error);
    throw error;
  }
}

/**
 * Check if a timeline ID is unique for a given owner
 * Checks within that specific user's timelines subcollection
 */
export async function isTimelineIdUnique(timelineId: string, ownerId: string): Promise<boolean> {
  try {
    const timelineRef = doc(db, COLLECTIONS.USERS, ownerId, COLLECTIONS.TIMELINES, timelineId);
    const timelineDoc = await getDocFromServer(timelineRef);

    // ID is unique if document doesn't exist in this user's subcollection
    return !timelineDoc.exists();
  } catch (error) {
    console.error('Error checking timeline ID uniqueness:', error);
    throw new Error(getFirestoreErrorMessage(error));
  }
}

/**
 * Update an existing timeline
 * First fetches the timeline to get the ownerId, then updates it
 */
export async function updateTimeline(timelineId: string, updates: Partial<Timeline>): Promise<void> {
  try {
    // First, get the timeline to find its owner
    const timeline = await getTimeline(timelineId);
    if (!timeline) {
      throw new Error(`Timeline ${timelineId} not found`);
    }

    // Update in the user's timelines subcollection
    const timelineRef = doc(db, COLLECTIONS.USERS, timeline.ownerId, COLLECTIONS.TIMELINES, timelineId);
    await updateDoc(timelineRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating timeline:', error);
    throw error;
  }
}

/**
 * Delete a timeline
 * First fetches the timeline to get the ownerId, then deletes it
 */
export async function deleteTimeline(timelineId: string): Promise<void> {
  try {
    // First, get the timeline to find its owner
    const timeline = await getTimeline(timelineId);
    if (!timeline) {
      throw new Error(`Timeline ${timelineId} not found`);
    }

    // Delete from the user's timelines subcollection
    const timelineRef = doc(db, COLLECTIONS.USERS, timeline.ownerId, COLLECTIONS.TIMELINES, timelineId);
    await deleteDoc(timelineRef);

    // v0.5.17 - Invalidate stats cache when timeline is deleted
    invalidateStatsCache();
  } catch (error) {
    console.error('Error deleting timeline:', error);
    throw error;
  }
}

/**
 * Increment timeline view count
 * First fetches the timeline metadata to get the ownerId, then increments the count
 * v0.5.0.1 - Event Persistence Optimization - Now uses getTimelineMetadata
 * v0.5.0.2 - Only increment if viewer is not the owner
 */
export async function incrementTimelineViewCount(timelineId: string, viewerId?: string): Promise<void> {
  try {
    // First, get the timeline metadata to find its owner (no need for events)
    const timeline = await getTimelineMetadata(timelineId);
    if (!timeline) {
      throw new Error(`Timeline ${timelineId} not found`);
    }

    // Don't increment view count if the viewer is the owner
    if (viewerId && viewerId === timeline.ownerId) {
      return;
    }

    // Increment in the user's timelines subcollection
    const timelineRef = doc(db, COLLECTIONS.USERS, timeline.ownerId, COLLECTIONS.TIMELINES, timelineId);
    await updateDoc(timelineRef, {
      viewCount: increment(1),
    });
  } catch (error) {
    console.error('Error incrementing view count:', error);
    throw error;
  }
}

/**
 * Subscribe to timeline changes (real-time updates) with all events
 * Uses collection group to find the timeline across all users
 * v0.5.0.1 - Event Persistence Optimization - Now fetches events separately
 */
export function subscribeToTimeline(
  timelineId: string,
  callback: (timeline: Timeline | null) => void
): Unsubscribe {
  // Use collection group query to find the timeline across all users
  const q = query(
    collectionGroup(db, COLLECTIONS.TIMELINES),
    where('id', '==', timelineId),
    limit(1)
  );

  return onSnapshot(q, async (querySnapshot) => {
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const metadata = { id: doc.id, ...doc.data() } as TimelineMetadata;

      // Fetch events separately
      try {
        const events = await getTimelineEvents(timelineId, metadata.ownerId);
        callback({ ...metadata, events });
      } catch (error) {
        console.error('Error fetching events in timeline subscription:', error);
        callback(null);
      }
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error in timeline subscription:', error);
    callback(null);
  });
}

/**
 * Subscribe to timelines metadata with filters (real-time updates)
 * Uses collection group to query across all users' timeline subcollections
 * v0.5.0.1 - Event Persistence Optimization - Now returns metadata only
 */
export function subscribeToTimelines(
  callback: (timelines: TimelineMetadata[]) => void,
  options?: Parameters<typeof getTimelines>[0]
): Unsubscribe {
  const constraints: QueryConstraint[] = [];

  if (options?.ownerId) {
    constraints.push(where('ownerId', '==', options.ownerId));
  }

  if (options?.visibility) {
    constraints.push(where('visibility', '==', options.visibility));
  }

  if (options?.featured !== undefined) {
    constraints.push(where('featured', '==', options.featured));
  }

  if (options?.orderByField) {
    constraints.push(orderBy(options.orderByField, options.orderDirection || 'desc'));
  } else {
    constraints.push(orderBy('updatedAt', 'desc'));
  }

  if (options?.limitCount) {
    constraints.push(limit(options.limitCount));
  }

  // Use collection group to query across all users' timeline subcollections
  const q = query(collectionGroup(db, COLLECTIONS.TIMELINES), ...constraints);

  return onSnapshot(q, (querySnapshot) => {
    const timelines = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as TimelineMetadata[];
    callback(timelines);
  }, (error) => {
    console.error('Error in timelines subscription:', error);
    callback([]);
  });
}

// ============================================================================
// User Operations
// ============================================================================

/**
 * Get a user by ID
 */
export async function getUser(userId: string): Promise<User | null> {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    return { id: userSnap.id, ...userSnap.data() } as User;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

/**
 * Get all users
 */
export async function getUsers(): Promise<User[]> {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as User[];
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

/**
 * Create a new user
 */
export async function createUser(user: Omit<User, 'createdAt'>): Promise<void> {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, user.id);
    const now = new Date().toISOString();

    await setDoc(userRef, {
      ...user,
      createdAt: now,
      role: user.role || 'user',
    });
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

/**
 * Update an existing user
 */
export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(userRef, updates);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

/**
 * Delete a user
 */
export async function deleteUser(userId: string): Promise<void> {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await deleteDoc(userRef);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/**
 * Delete all user data (GDPR compliance)
 * Deletes:
 * - All user's timelines (and their events subcollections)
 * - User document from /users/{uid}
 * Note: Firebase Auth account must be deleted separately by the caller
 * v0.9.0 - Account deletion feature
 */
export async function deleteUserData(userId: string): Promise<void> {
  try {
    // Get all timelines owned by the user
    const timelinesRef = collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.TIMELINES);
    const timelinesSnapshot = await getDocs(timelinesRef);

    // Delete each timeline and its events subcollection
    for (const timelineDoc of timelinesSnapshot.docs) {
      const timelineId = timelineDoc.id;

      // Delete all events in this timeline
      const eventsRef = collection(
        db,
        COLLECTIONS.USERS,
        userId,
        COLLECTIONS.TIMELINES,
        timelineId,
        COLLECTIONS.EVENTS
      );
      const eventsSnapshot = await getDocs(eventsRef);

      // Use batch delete for events
      const batch = writeBatch(db);
      eventsSnapshot.docs.forEach(eventDoc => {
        batch.delete(eventDoc.ref);
      });
      await batch.commit();

      // Delete the timeline document
      await deleteDoc(timelineDoc.ref);
    }

    // Delete the user document
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await deleteDoc(userRef);

    // Invalidate stats cache
    invalidateStatsCache();
  } catch (error) {
    console.error('Error deleting user data:', error);
    throw error;
  }
}

/**
 * Get user by email address
 * v0.5.1 - Registration validation
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('email', '==', email),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as User;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    throw error;
  }
}

/**
 * Get user by username
 * v0.5.1 - Registration validation
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('username', '==', username.toLowerCase()),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as User;
  } catch (error) {
    console.error('Error fetching user by username:', error);
    throw error;
  }
}

/**
 * Check if username is available
 * v0.5.1 - Registration validation
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  try {
    const user = await getUserByUsername(username);
    return user === null;
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false; // Assume not available on error to be safe
  }
}

/**
 * Check if email is available (not already registered)
 * v0.5.1 - Registration validation
 */
export async function isEmailAvailable(email: string): Promise<boolean> {
  try {
    const user = await getUserByEmail(email);
    return user === null;
  } catch (error) {
    console.error('Error checking email availability:', error);
    return false; // Assume not available on error to be safe
  }
}

// ============================================================================
// Admin Activity Log Operations
// ============================================================================

/**
 * Create a new activity log entry
 */
export async function createActivityLog(
  log: Omit<AdminActivityLog, 'id' | 'timestamp'>
): Promise<string> {
  try {
    const logRef = doc(collection(db, COLLECTIONS.ACTIVITY_LOGS));
    const now = new Date().toISOString();

    const newLog: AdminActivityLog = {
      ...log,
      id: logRef.id,
      timestamp: now,
    };

    await setDoc(logRef, newLog);
    return logRef.id;
  } catch (error) {
    console.error('Error creating activity log:', error);
    throw error;
  }
}

/**
 * Get activity logs (with optional filters)
 */
export async function getActivityLogs(options?: {
  adminUserId?: string;
  action?: AdminActivityLog['action'];
  targetType?: AdminActivityLog['targetType'];
  limitCount?: number;
}): Promise<AdminActivityLog[]> {
  try {
    const constraints: QueryConstraint[] = [
      orderBy('timestamp', 'desc')
    ];

    if (options?.adminUserId) {
      constraints.push(where('adminUserId', '==', options.adminUserId));
    }

    if (options?.action) {
      constraints.push(where('action', '==', options.action));
    }

    if (options?.targetType) {
      constraints.push(where('targetType', '==', options.targetType));
    }

    if (options?.limitCount) {
      constraints.push(limit(options.limitCount));
    }

    const q = query(collection(db, COLLECTIONS.ACTIVITY_LOGS), ...constraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as AdminActivityLog[];
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    throw error;
  }
}

/**
 * Subscribe to activity logs (real-time updates)
 */
export function subscribeToActivityLogs(
  callback: (logs: AdminActivityLog[]) => void,
  options?: Parameters<typeof getActivityLogs>[0]
): Unsubscribe {
  const constraints: QueryConstraint[] = [
    orderBy('timestamp', 'desc')
  ];

  if (options?.adminUserId) {
    constraints.push(where('adminUserId', '==', options.adminUserId));
  }

  if (options?.action) {
    constraints.push(where('action', '==', options.action));
  }

  if (options?.targetType) {
    constraints.push(where('targetType', '==', options.targetType));
  }

  if (options?.limitCount) {
    constraints.push(limit(options.limitCount));
  }

  const q = query(collection(db, COLLECTIONS.ACTIVITY_LOGS), ...constraints);

  return onSnapshot(q, (querySnapshot) => {
    const logs = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as AdminActivityLog[];
    callback(logs);
  }, (error) => {
    console.error('Error in activity logs subscription:', error);
    callback([]);
  });
}

// ============================================================================
// Platform Statistics (v0.5.22 - Cloud Functions + Client Caching)
// ============================================================================
// Stats are now maintained by Cloud Functions triggers (onUserCreate, onTimelineCreate, etc.)
// This client code provides caching and fallback calculation for initialization.

/**
 * Check if cached stats are still valid
 */
function isStatsCacheValid(): boolean {
  return statsCache.data !== null && (Date.now() - statsCache.timestamp) < STATS_CACHE_TTL_MS;
}

/**
 * Get platform stats from Firestore stats/platform document
 */
async function getStatsFromFirestore(): Promise<PlatformStats | null> {
  try {
    const statsRef = doc(db, COLLECTIONS.STATS, STATS_DOCS.PLATFORM);
    const statsDoc = await getDoc(statsRef);
    if (statsDoc.exists()) {
      return statsDoc.data() as PlatformStats;
    }
    return null;
  } catch (error) {
    console.warn('Error reading stats document:', error);
    return null;
  }
}

/**
 * Save platform stats to Firestore stats/platform document
 * Used for initial bootstrap before Cloud Functions are deployed
 */
async function saveStatsToFirestore(stats: PlatformStats): Promise<void> {
  try {
    const statsRef = doc(db, COLLECTIONS.STATS, STATS_DOCS.PLATFORM);
    await setDoc(statsRef, stats);
  } catch (error) {
    console.warn('Error saving stats document:', error);
  }
}

/**
 * Calculate platform stats by scanning all documents (fallback/bootstrap)
 * This is only used when stats/platform document doesn't exist yet.
 * Once Cloud Functions are deployed, they maintain stats in real-time.
 */
async function calculatePlatformStats(): Promise<PlatformStats> {
  const [users, timelines] = await Promise.all([
    getUsers(),
    getTimelines(),
  ]);

  const totalEvents = timelines.reduce((sum, t) => sum + (t.eventCount || 0), 0);
  const totalViews = timelines.reduce((sum, t) => sum + t.viewCount, 0);

  const publicTimelines = timelines.filter(t => t.visibility === 'public').length;
  const unlistedTimelines = timelines.filter(t => t.visibility === 'unlisted').length;
  const privateTimelines = timelines.filter(t => t.visibility === 'private').length;

  return {
    totalUsers: users.length,
    totalTimelines: timelines.length,
    totalEvents,
    totalViews,
    publicTimelines,
    unlistedTimelines,
    privateTimelines,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get platform-wide statistics
 * v0.5.22 - Cloud Functions maintain stats in real-time
 *
 * Priority:
 * 1. Return from memory cache if valid (TTL: 5 minutes)
 * 2. Read from stats/platform Firestore document (updated by Cloud Functions)
 * 3. Fall back to full scan for initial bootstrap only
 */
export async function getPlatformStats(): Promise<{
  totalUsers: number;
  totalTimelines: number;
  totalEvents: number;
  totalViews: number;
  publicTimelines: number;
  unlistedTimelines: number;
  privateTimelines: number;
}> {
  try {
    // 1. Check memory cache first
    if (isStatsCacheValid() && statsCache.data) {
      return statsCache.data;
    }

    // 2. Try to read from Firestore stats document (maintained by Cloud Functions)
    let stats = await getStatsFromFirestore();

    // 3. If no stats doc exists, calculate and save (initial bootstrap only)
    // With Cloud Functions deployed, stats doc should always exist and be fresh
    if (!stats) {
      stats = await calculatePlatformStats();
      // Save to Firestore for future reads
      await saveStatsToFirestore(stats);
    }

    // Update memory cache
    statsCache = { data: stats, timestamp: Date.now() };

    return stats;
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    throw error;
  }
}

/**
 * Force refresh of platform statistics
 * Recalculates from scratch and updates cache + Firestore
 */
export async function refreshPlatformStats(): Promise<PlatformStats> {
  const stats = await calculatePlatformStats();
  await saveStatsToFirestore(stats);
  statsCache = { data: stats, timestamp: Date.now() };
  return stats;
}

/**
 * Invalidate stats cache (call after user/timeline/event changes)
 */
export function invalidateStatsCache(): void {
  statsCache = { data: null, timestamp: 0 };
}

/**
 * Reset all statistics (view counts) across all timelines
 * v0.5.0.2 - Admin functionality to clear statistics
 */
export async function resetAllStatistics(): Promise<void> {
  try {
    // Get all users
    const users = await getUsers();

    // For each user, get their timelines and reset view counts
    for (const user of users) {
      const timelinesRef = collection(db, COLLECTIONS.USERS, user.id, COLLECTIONS.TIMELINES);
      const snapshot = await getDocs(timelinesRef);

      // Batch update all timelines for this user
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { viewCount: 0 });
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('Error resetting statistics:', error);
    throw error;
  }
}

/**
 * Migration: Backfill ownerUsername on all timelines
 * v0.8.11 - Run once via admin panel to populate denormalized field
 * @returns Object with count of updated timelines and list of failed timeline IDs
 */
export async function migrateTimelineOwnerUsernames(): Promise<{
  updated: number;
  failed: string[];
}> {
  try {
    // Get all users and create lookup map
    const users = await getUsers();
    const userMap = new Map(users.map(u => [u.id, u.username]));

    // Query all timelines across all users using collection group
    const timelinesRef = collectionGroup(db, COLLECTIONS.TIMELINES);
    const snapshot = await getDocs(timelinesRef);

    let updated = 0;
    const failed: string[] = [];

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      // Only update if ownerUsername is missing and ownerId exists
      if (!data.ownerUsername && data.ownerId) {
        const username = userMap.get(data.ownerId);
        if (username) {
          await updateDoc(docSnapshot.ref, { ownerUsername: username });
          updated++;
        } else {
          failed.push(docSnapshot.id);
        }
      }
    }

    return { updated, failed };
  } catch (error) {
    console.error('Error migrating timeline owner usernames:', error);
    throw error;
  }
}

/**
 * Search users by username prefix
 * v0.8.11 - On-demand search for HomePage (replaces loading all users)
 * Uses Firestore range query for prefix matching
 * @param searchQuery - Username prefix to search for
 * @param maxResults - Maximum number of results to return (default 5)
 */
export async function searchUsersByUsername(
  searchQuery: string,
  maxResults: number = 5
): Promise<User[]> {
  try {
    if (!searchQuery || searchQuery.trim().length < 2) {
      return [];
    }

    const normalizedQuery = searchQuery.toLowerCase().trim();
    const usersRef = collection(db, COLLECTIONS.USERS);

    // Firestore doesn't support LIKE, so use range query for prefix matching
    // The \uf8ff character is a high code point that comes after most characters
    const q = query(
      usersRef,
      where('username', '>=', normalizedQuery),
      where('username', '<=', normalizedQuery + '\uf8ff'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  } catch (error) {
    console.error('Error searching users by username:', error);
    throw error;
  }
}
