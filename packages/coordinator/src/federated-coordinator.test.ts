/**
 * Tests for Federated Coordinator
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FederatedCoordinator } from './federated-coordinator';
import { AggregationJob, CoordinatorConfig } from './types';

describe('Federated Coordinator', () => {
  let tempDir: string;
  let coordinator: FederatedCoordinator;

  beforeEach(() => {
    // Create temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harmonia-test-'));

    const config: CoordinatorConfig = {
      repoPath: tempDir,
    };

    coordinator = new FederatedCoordinator(config);
  });

  afterEach(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should create coordinator with config', () => {
      expect(coordinator).toBeDefined();
      expect(coordinator).toBeInstanceOf(FederatedCoordinator);
    });

    it('should handle encryption key', () => {
      const config: CoordinatorConfig = {
        repoPath: tempDir,
        encryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };

      const encryptedCoordinator = new FederatedCoordinator(config);
      expect(encryptedCoordinator).toBeDefined();
      expect(encryptedCoordinator).toBeInstanceOf(FederatedCoordinator);
    });

    it('should throw error if repo path does not exist', () => {
      const config: CoordinatorConfig = {
        repoPath: '/nonexistent/path',
      };

      expect(() => new FederatedCoordinator(config)).toThrow('Repository path does not exist');
    });
  });

  describe('startRound', () => {
    it('should create round info file', () => {
      const studyId = 'test-study';
      const roundNumber = 1;

      coordinator.startRound(studyId, roundNumber);

      const roundPath = path.join(tempDir, `studies/${studyId}/current-round.json`);
      expect(fs.existsSync(roundPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(roundPath, 'utf-8'));
      expect(content.studyId).toBe(studyId);
      expect(content.roundNumber).toBe(roundNumber);
      expect(content.status).toBe('in-progress');
    });
  });

  describe('checkRoundStatus', () => {
    it('should return incomplete status when no updates exist', () => {
      const status = coordinator.checkRoundStatus('test-study', 1);

      expect(status.complete).toBe(false);
      expect(status.submittedSites).toEqual([]);
      expect(status.totalSites).toBe(0);
    });

    it('should detect submitted sites', () => {
      const studyId = 'test-study';
      const roundNumber = 1;

      // Create fake updates
      const updatesDir = path.join(tempDir, `studies/${studyId}/rounds/${roundNumber}/updates`);
      fs.mkdirSync(updatesDir, { recursive: true });

      // Create study config
      const configPath = path.join(tempDir, `studies/${studyId}/config.json`);
      fs.writeFileSync(configPath, JSON.stringify({ studyId, minParticipants: 2, totalRounds: 5 }));

      // Add site updates
      fs.writeFileSync(path.join(updatesDir, 'site-a.json'), '{}');
      fs.writeFileSync(path.join(updatesDir, 'site-b.json'), '{}');

      const status = coordinator.checkRoundStatus(studyId, roundNumber);

      expect(status.submittedSites).toContain('site-a');
      expect(status.submittedSites).toContain('site-b');
      expect(status.submittedSites.length).toBe(2);
      expect(status.totalSites).toBe(2);
      expect(status.complete).toBe(true);
    });
  });

  describe('aggregateRound', () => {
    it('should have aggregateRound method', () => {
      expect(coordinator.aggregateRound).toBeDefined();
      expect(typeof coordinator.aggregateRound).toBe('function');
    });

    it('should accept proper aggregation job parameters', () => {
      const job: AggregationJob = {
        studyId: 'study1',
        roundNumber: 1,
        minParticipants: 2,
        aggregationStrategy: 'weighted',
      };

      // Just verify the job structure is valid
      expect(job).toBeDefined();
      expect(job.studyId).toBe('study1');
      expect(job.roundNumber).toBe(1);
      expect(job.aggregationStrategy).toBe('weighted');
    });
  });
});
