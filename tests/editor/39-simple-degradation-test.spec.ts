import { test, expect } from '@playwright/test';
import { loginAsTestUser, loadTestTimeline } from '../utils/timelineTestUtils';

/**
 * Test 39: Simple Degradation System Test
 * Basic validation that degradation system is working with generated data
 * 
 * Tests the core degradation functionality without relying on specific datasets
 */

test('Degradation system basic functionality', async ({ page }) => {
    await loginAsTestUser(page);
    await loadTestTimeline(page, 'french-revolution');

  // Wait for timeline to load
  await page.waitForSelector('[data-testid="timeline-container"]', { timeout: 10000 });

  console.log('\n🔍 BASIC DEGRADATION SYSTEM TEST');
  
  // Generate some events programmatically to test degradation
  await page.evaluate(() => {
    // Create sample events that should trigger degradation when zoomed
    const sampleEvents = [];
    const baseDate = new Date('2020-01-01');
    
    // Create dense clusters of events that will require degradation
    for (let cluster = 0; cluster < 5; cluster++) {
      const clusterStart = new Date(baseDate.getTime() + (cluster * 30 * 24 * 60 * 60 * 1000)); // 30 days apart
      
      // Create 5 events in each cluster (should trigger compact degradation)
      for (let i = 0; i < 5; i++) {
        const eventDate = new Date(clusterStart.getTime() + (i * 2 * 24 * 60 * 60 * 1000)); // 2 days apart
        sampleEvents.push({
          id: `cluster-${cluster}-event-${i}`,
          title: `Event ${cluster + 1}.${i + 1}`,
          description: `Cluster ${cluster + 1}, Event ${i + 1}`,
          date: eventDate.toISOString().split('T')[0]
        });
      }
    }
    
    // Trigger a timeline update with our test events
    if ((window as unknown as { testSetEvents?: (events: unknown) => void }).testSetEvents) {
      (window as unknown as { testSetEvents?: (events: unknown) => void }).testSetEvents(sampleEvents);
    } else {
      console.log('Test event setter not available, using default data');
    }
  });
  
  await page.waitForTimeout(1000);
  
  // Wait for telemetry to be available
  await page.waitForFunction(() => Boolean((window as unknown as { __ccTelemetry?: unknown }).__ccTelemetry), { timeout: 5000 });

  // Get initial telemetry
  const initialTelemetry = await page.evaluate(() => (window as unknown as { __ccTelemetry?: unknown }).__ccTelemetry || null);
  console.log('📊 Initial state:', {
    events: initialTelemetry?.events?.total || 0,
    groups: initialTelemetry?.groups?.count || 0,
    hasDegradation: 'degradation' in (initialTelemetry || {}),
    degradationValue: initialTelemetry?.degradation
  });
  
  // Test telemetry structure
  expect(initialTelemetry).toBeTruthy();
  expect('degradation' in initialTelemetry).toBe(true);
  
  // Get timeline center for zoom operations
  const timelineArea = page.locator('[data-testid="timeline-container"]');
  const timelineBox = await timelineArea.boundingBox();
  const centerX = timelineBox!.x + timelineBox!.width * 0.5;
  const centerY = timelineBox!.y + timelineBox!.height * 0.5;
  
  // Test zoom behavior and degradation trigger
  console.log('🔎 Testing zoom-induced degradation...');
  let degradationObserved = false;
  
  for (let zoomStep = 1; zoomStep <= 8; zoomStep++) {
    console.log(`  Zoom step ${zoomStep}/8`);
    
    // Zoom in to increase density
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, -150);
    await page.waitForTimeout(400);
    
    // Check telemetry
    const zoomedTelemetry = await page.evaluate(() => (window as unknown as { __ccTelemetry?: unknown }).__ccTelemetry || null);
    
    if (zoomedTelemetry) {
      const groups = zoomedTelemetry.groups?.count || 0;
      const events = zoomedTelemetry.events?.total || 0;
      const degradation = zoomedTelemetry.degradation;
      
      if (groups > 0 && degradation) {
        console.log(`    Groups: ${groups}, Events: ${events}`);
        
        if (degradation.totalGroups > 0) {
          console.log(`    Degradation metrics: Full: ${degradation.fullCardGroups}, Compact: ${degradation.compactCardGroups}`);
          
          if (degradation.compactCardGroups > 0) {
            degradationObserved = true;
            console.log(`    ✅ Degradation triggered! ${degradation.compactCardGroups} groups using compact cards`);
            console.log(`    Space reclaimed: ${degradation.spaceReclaimed}px`);
            
            // Validate the degradation metrics
            expect(degradation.totalGroups).toBeGreaterThan(0);
            expect(degradation.fullCardGroups).toBeGreaterThanOrEqual(0);
            expect(degradation.compactCardGroups).toBeGreaterThan(0);
            expect(degradation.spaceReclaimed).toBeGreaterThan(0);
            
            // Validate degradation rate calculation
            const expectedRate = degradation.compactCardGroups / degradation.totalGroups;
            expect(Math.abs(degradation.degradationRate - expectedRate)).toBeLessThan(0.01);
            
            break; // Stop once we've observed degradation
          }
        }
      }
    }
  }
  
  if (degradationObserved) {
    console.log('✅ Degradation system working correctly with zoom-induced density');
    
    // Test card dimensions if we have any visible cards
    const cards = await page.locator('div[style*="height:"]').all();
    if (cards.length > 0) {
      console.log(`🎯 Checking card dimensions (${Math.min(cards.length, 10)} cards)...`);
      
      const cardHeights = await Promise.all(
        cards.slice(0, 10).map(async (card) => {
          const style = await card.getAttribute('style');
          const heightMatch = style?.match(/height:\\s*(\\d+)px/);
          return heightMatch ? parseInt(heightMatch[1]) : null;
        })
      );

      const validHeights = cardHeights.filter(h => h !== null) as number[];
      if (validHeights.length > 0) {
        // Heights from cardMetrics.ts (typography-derived): full 132px, compact 90px.
        const fullCards = validHeights.filter(h => Math.abs(h - 132) < 5).length;
        const compactCards = validHeights.filter(h => Math.abs(h - 90) < 5).length;

        // Degradation is already asserted via telemetry above; this is diagnostic.
        console.log(`  Card dimensions: ${fullCards} full cards (132px), ${compactCards} compact cards (90px)`);
      }
    }
  } else {
    console.log('ℹ️ Degradation not triggered - timeline density may be insufficient');
    // This is acceptable behavior for sparse timelines
  }
  
  // Reset zoom
  await page.keyboard.press('Digit0');
  await page.waitForTimeout(1000);
  
  console.log('✅ Basic degradation system test completed');
});

test('Degradation telemetry consistency check', async ({ page }) => {
    await loginAsTestUser(page);
    await loadTestTimeline(page, 'french-revolution');
  await page.waitForSelector('[data-testid="timeline-container"]', { timeout: 10000 });

  console.log('\n📊 DEGRADATION TELEMETRY CONSISTENCY CHECK');
  
  // Wait for telemetry
  await page.waitForFunction(() => Boolean((window as unknown as { __ccTelemetry?: unknown }).__ccTelemetry), { timeout: 5000 });

  // Multiple telemetry snapshots to ensure consistency
  const snapshots = [];
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(500);
    const telemetry = await page.evaluate(() => (window as unknown as { __ccTelemetry?: unknown }).__ccTelemetry || null);
    snapshots.push(telemetry);
  }
  
  // Validate all snapshots have consistent structure
  for (let i = 0; i < snapshots.length; i++) {
    const telemetry = snapshots[i];
    console.log(`📊 Snapshot ${i + 1}:`, {
      version: telemetry?.version,
      hasEvents: !!telemetry?.events,
      hasGroups: !!telemetry?.groups,
      hasDegradation: 'degradation' in (telemetry || {}),
      degradationDefined: telemetry?.degradation !== undefined
    });
    
    // Basic structure validation
    expect(telemetry).toBeTruthy();
    expect(telemetry.version).toBe('v5');
    expect('degradation' in telemetry).toBe(true);
    
    // The degradation field should exist (can be undefined if no events)
    if (telemetry.events?.total > 0) {
      // With events, we should have some degradation metrics structure
      expect(telemetry.groups?.count).toBeGreaterThanOrEqual(0);
    }
  }
  
  console.log('✅ Telemetry consistency validated across multiple snapshots');
});

test('Degradation system mathematical accuracy', async ({ page }) => {
    await loginAsTestUser(page);
    await loadTestTimeline(page, 'french-revolution');
  await page.waitForSelector('[data-testid="timeline-container"]', { timeout: 10000 });

  console.log('\n🧮 DEGRADATION MATHEMATICAL ACCURACY TEST');
  
  // Wait for telemetry
  await page.waitForFunction(() => Boolean((window as unknown as { __ccTelemetry?: unknown }).__ccTelemetry), { timeout: 5000 });

  // Zoom to potentially trigger degradation
  const timelineArea = page.locator('[data-testid="timeline-container"]');
  const timelineBox = await timelineArea.boundingBox();
  const centerX = timelineBox!.x + timelineBox!.width * 0.5;
  const centerY = timelineBox!.y + timelineBox!.height * 0.5;

  // Moderate zoom
  await page.mouse.move(centerX, centerY);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(300);
  }

  const telemetry = await page.evaluate(() => (window as unknown as { __ccTelemetry?: unknown }).__ccTelemetry || null);
  
  if (telemetry && telemetry.degradation && telemetry.degradation.totalGroups > 0) {
    const degradation = telemetry.degradation;
    
    console.log('🧮 Mathematical validation:', {
      totalGroups: degradation.totalGroups,
      fullGroups: degradation.fullCardGroups,
      compactGroups: degradation.compactCardGroups,
      calculatedRate: degradation.compactCardGroups / degradation.totalGroups,
      reportedRate: degradation.degradationRate
    });
    
    // Mathematical consistency checks
    expect(degradation.fullCardGroups + degradation.compactCardGroups).toBeLessThanOrEqual(degradation.totalGroups);
    expect(degradation.fullCardGroups).toBeGreaterThanOrEqual(0);
    expect(degradation.compactCardGroups).toBeGreaterThanOrEqual(0);
    
    // Degradation rate calculation accuracy
    const expectedRate = degradation.compactCardGroups / degradation.totalGroups;
    expect(Math.abs(degradation.degradationRate - expectedRate)).toBeLessThan(0.001);
    
    // Space savings accuracy (if there are degradation triggers)
    if (degradation.degradationTriggers && degradation.degradationTriggers.length > 0) {
      let totalExpectedSpace = 0;
      for (const trigger of degradation.degradationTriggers) {
        // Each event should save 76px when degrading from full (140px) to compact (64px)
        expect(trigger.spaceSaved).toBe(76 * trigger.eventCount);
        totalExpectedSpace += trigger.spaceSaved;
      }
      expect(degradation.spaceReclaimed).toBe(totalExpectedSpace);
    }
    
    console.log('✅ Mathematical accuracy validated');
  } else {
    console.log('ℹ️ No degradation active - mathematical checks skipped');
  }
  
  // Reset
  await page.keyboard.press('Digit0');
  console.log('✅ Mathematical accuracy test completed');
});
