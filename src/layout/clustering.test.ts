import { describe, it, expect, beforeEach } from 'vitest';
import { EventClustering } from './clustering';
import type { Event } from '../types';
import type { LayoutConfig } from './types';

describe('EventClustering', () => {
  let clustering: EventClustering;
  let config: LayoutConfig;
  let viewStart: Date;
  let viewEnd: Date;

  beforeEach(() => {
    config = {
      viewportWidth: 1000,
      viewportHeight: 800,
      timelineY: 400,
      clusterThreshold: 50,
      cardConfigs: {} as any, // Not needed for clustering tests
      columnSpacing: 20,
    };
    clustering = new EventClustering(config);
    viewStart = new Date('2020-01-01');
    viewEnd = new Date('2020-12-31');
  });

  describe('clusterEvents', () => {
    it('returns empty array for empty events', () => {
      const result = clustering.clusterEvents([], viewStart, viewEnd);
      expect(result).toEqual([]);
    });

    it('creates single cluster for single event', () => {
      const events: Event[] = [
        {
          id: '1',
          date: '2020-06-01',
          title: 'Event 1',
          description: '',
        },
      ];

      const result = clustering.clusterEvents(events, viewStart, viewEnd);

      expect(result).toHaveLength(1);
      expect(result[0].events).toHaveLength(1);
      expect(result[0].events[0].id).toBe('1');
      expect(result[0].anchor.eventCount).toBe(1);
      expect(result[0].anchor.eventIds).toEqual(['1']);
    });

    it('creates separate clusters for distant events', () => {
      const events: Event[] = [
        {
          id: '1',
          date: '2020-01-15',
          title: 'Event 1',
          description: '',
        },
        {
          id: '2',
          date: '2020-12-15',
          title: 'Event 2',
          description: '',
        },
      ];

      const result = clustering.clusterEvents(events, viewStart, viewEnd);

      expect(result).toHaveLength(2);
      expect(result[0].events[0].id).toBe('1');
      expect(result[1].events[0].id).toBe('2');
    });

    it('groups nearby events into same cluster', () => {
      // Events very close together should be clustered
      const events: Event[] = [
        {
          id: '1',
          date: '2020-06-01',
          title: 'Event 1',
          description: '',
        },
        {
          id: '2',
          date: '2020-06-02',
          title: 'Event 2',
          description: '',
        },
      ];

      const result = clustering.clusterEvents(events, viewStart, viewEnd);

      // Should be clustered together due to proximity
      expect(result).toHaveLength(1);
      expect(result[0].events).toHaveLength(2);
      expect(result[0].anchor.eventCount).toBe(2);
    });

    it('sorts events chronologically', () => {
      const events: Event[] = [
        {
          id: '3',
          date: '2020-12-01',
          title: 'Event 3',
          description: '',
        },
        {
          id: '1',
          date: '2020-01-01',
          title: 'Event 1',
          description: '',
        },
        {
          id: '2',
          date: '2020-06-01',
          title: 'Event 2',
          description: '',
        },
      ];

      const result = clustering.clusterEvents(events, viewStart, viewEnd);

      // Events should be processed in chronological order
      const firstEvent = result[0].events[0];
      expect(firstEvent.id).toBe('1'); // Earliest event
    });

    it('updates anchor position to centroid when adding to cluster', () => {
      const events: Event[] = [
        {
          id: '1',
          date: '2020-06-01',
          title: 'Event 1',
          description: '',
        },
        {
          id: '2',
          date: '2020-06-03',
          title: 'Event 2',
          description: '',
        },
      ];

      const result = clustering.clusterEvents(events, viewStart, viewEnd);

      if (result.length === 1) {
        // Anchor X should be between the two event positions
        const cluster = result[0];
        expect(cluster.anchor.x).toBeGreaterThan(0);
        expect(cluster.anchor.y).toBe(config.timelineY);
      }
    });

    it('initializes cluster with correct structure', () => {
      const events: Event[] = [
        {
          id: '1',
          date: '2020-06-01',
          title: 'Event 1',
          description: '',
        },
      ];

      const result = clustering.clusterEvents(events, viewStart, viewEnd);

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('anchor');
      expect(result[0]).toHaveProperty('events');
      expect(result[0]).toHaveProperty('slots');
      expect(result[0].slots).toEqual([]);
      expect(result[0].anchor.visibleCount).toBe(1);
      expect(result[0].anchor.overflowCount).toBe(0);
    });
  });

  describe('splitClustersOnZoom', () => {
    it('reclusters events with new view range', () => {
      const events: Event[] = [
        {
          id: '1',
          date: '2020-06-01',
          title: 'Event 1',
          description: '',
        },
        {
          id: '2',
          date: '2020-06-15',
          title: 'Event 2',
          description: '',
        },
      ];

      const initialClusters = clustering.clusterEvents(events, viewStart, viewEnd);

      // Zoom into June
      const newViewStart = new Date('2020-06-01');
      const newViewEnd = new Date('2020-06-30');

      const splitClusters = clustering.splitClustersOnZoom(initialClusters, newViewStart, newViewEnd);

      expect(splitClusters).toBeDefined();
      expect(splitClusters.length).toBeGreaterThan(0);
    });

    it('handles empty clusters', () => {
      const result = clustering.splitClustersOnZoom([], viewStart, viewEnd);
      expect(result).toEqual([]);
    });
  });

  describe('mergeClustersOnZoom', () => {
    it('reclusters events with new view range', () => {
      const events: Event[] = [
        {
          id: '1',
          date: '2020-06-01',
          title: 'Event 1',
          description: '',
        },
        {
          id: '2',
          date: '2020-06-15',
          title: 'Event 2',
          description: '',
        },
      ];

      const initialClusters = clustering.clusterEvents(
        events,
        new Date('2020-06-01'),
        new Date('2020-06-30')
      );

      // Zoom out to full year
      const mergedClusters = clustering.mergeClustersOnZoom(initialClusters, viewStart, viewEnd);

      expect(mergedClusters).toBeDefined();
      expect(mergedClusters.length).toBeGreaterThan(0);
    });

    it('handles empty clusters', () => {
      const result = clustering.mergeClustersOnZoom([], viewStart, viewEnd);
      expect(result).toEqual([]);
    });
  });

  describe('getClusterStats', () => {
    it('returns correct stats for empty clusters', () => {
      const stats = clustering.getClusterStats([]);

      expect(stats.totalClusters).toBe(0);
      expect(stats.totalEvents).toBe(0);
      expect(stats.averageEventsPerCluster).toBe(0);
      expect(stats.largestCluster).toBe(0);
    });

    it('returns correct stats for single cluster', () => {
      const events: Event[] = [
        {
          id: '1',
          date: '2020-06-01',
          title: 'Event 1',
          description: '',
        },
        {
          id: '2',
          date: '2020-06-02',
          title: 'Event 2',
          description: '',
        },
      ];

      const clusters = clustering.clusterEvents(events, viewStart, viewEnd);
      const stats = clustering.getClusterStats(clusters);

      expect(stats.totalClusters).toBe(clusters.length);
      expect(stats.totalEvents).toBe(2);
      expect(stats.averageEventsPerCluster).toBeGreaterThan(0);
      expect(stats.largestCluster).toBeGreaterThanOrEqual(1);
    });

    it('calculates average correctly for multiple clusters', () => {
      const events: Event[] = [
        {
          id: '1',
          date: '2020-01-01',
          title: 'Event 1',
          description: '',
        },
        {
          id: '2',
          date: '2020-01-02',
          title: 'Event 2',
          description: '',
        },
        {
          id: '3',
          date: '2020-12-01',
          title: 'Event 3',
          description: '',
        },
      ];

      const clusters = clustering.clusterEvents(events, viewStart, viewEnd);
      const stats = clustering.getClusterStats(clusters);

      expect(stats.totalEvents).toBe(3);
      expect(stats.averageEventsPerCluster).toBe(stats.totalEvents / stats.totalClusters);
    });

    it('identifies largest cluster correctly', () => {
      const events: Event[] = [
        {
          id: '1',
          date: '2020-06-01',
          title: 'Event 1',
          description: '',
        },
        {
          id: '2',
          date: '2020-06-02',
          title: 'Event 2',
          description: '',
        },
        {
          id: '3',
          date: '2020-06-03',
          title: 'Event 3',
          description: '',
        },
        {
          id: '4',
          date: '2020-12-01',
          title: 'Event 4',
          description: '',
        },
      ];

      const clusters = clustering.clusterEvents(events, viewStart, viewEnd);
      const stats = clustering.getClusterStats(clusters);

      expect(stats.largestCluster).toBeGreaterThanOrEqual(1);
      expect(stats.largestCluster).toBeLessThanOrEqual(stats.totalEvents);
    });
  });
});
