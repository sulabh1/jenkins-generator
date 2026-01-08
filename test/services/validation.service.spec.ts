import { ValidationService } from '../../src/services/validation.service';

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(() => {
    service = new ValidationService();
  });

  describe('validatePort', () => {
    it('should return true for valid ports', () => {
      expect(service.validatePort(80)).toBe(true);
      expect(service.validatePort(3000)).toBe(true);
      expect(service.validatePort(65535)).toBe(true);
    });

    it('should return false for invalid ports', () => {
      expect(service.validatePort(0)).toBe(false);
      expect(service.validatePort(70000)).toBe(false);
      expect(service.validatePort(-1)).toBe(false);
    });
  });

  describe('validateGitRepository', () => {
    it('should return true for valid git URLs', () => {
      expect(
        service.validateGitRepository('https://github.com/user/repo.git'),
      ).toBe(true);
      expect(
        service.validateGitRepository('https://github.com/user/repo'),
      ).toBe(true);
      expect(
        service.validateGitRepository('git@github.com:user/repo.git'),
      ).toBe(true);
    });

    it('should return false for invalid git URLs', () => {
      expect(service.validateGitRepository('not-a-url')).toBe(false);
      expect(service.validateGitRepository('http://google.com')).toBe(false);
    });
  });

  describe('validateInstanceType', () => {
    it('should return true for valid AWS instance types', () => {
      expect(service.validateInstanceType('aws', 't2.micro')).toBe(true);
      expect(service.validateInstanceType('aws', 'm5.large')).toBe(true);
    });

    it('should return false for invalid AWS instance types', () => {
      expect(service.validateInstanceType('aws', 'invalid-type')).toBe(false);
    });

    it('should return true for valid GCP instance types', () => {
      expect(service.validateInstanceType('gcp', 'e2-micro')).toBe(true);
    });
  });
});
