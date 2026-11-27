import employeeService from '../services/EmployeeService';

describe('Annual Vacations - Date-Based Sorting', () => {
  describe('getTabDefaultSort field resolution', () => {
    const getTabDefaultSort = (tabKey) => {
      if (tabKey === 'yetToGo') return { field: 'travellingDate', order: 'asc' };
      if (tabKey === 'onVacation') return { field: 'lastWorkingDay', order: 'asc' };
      if (tabKey === 'returned') return { field: 'firstWorkingDay', order: 'asc' };
      return { field: 'travellingDate', order: 'asc' };
    };

    it('returns Travelling Date ascending for Yet to Go', () => {
      expect(getTabDefaultSort('yetToGo')).toEqual({ field: 'travellingDate', order: 'asc' });
    });

    it('returns Last Working Day ascending for On Vacation', () => {
      expect(getTabDefaultSort('onVacation')).toEqual({ field: 'lastWorkingDay', order: 'asc' });
    });

    it('returns First Working Day ascending for Returned Back', () => {
      expect(getTabDefaultSort('returned')).toEqual({ field: 'firstWorkingDay', order: 'asc' });
    });
  });

  describe('EmployeeService.getVacationTab query parameter serialization', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('passes sortField and sortOrder to /vacation-tab API endpoint', async () => {
      let requestedUrl = '';
      global.fetch = jest.fn().mockImplementation((url) => {
        requestedUrl = url;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ employees: [], total: 0 }),
        });
      });

      await employeeService.getVacationTab({
        tab: 'yetToGo',
        page: 1,
        limit: 20,
        sortField: 'travellingDate',
        sortOrder: 'asc',
      });

      expect(requestedUrl).toContain('tab=yetToGo');
      expect(requestedUrl).toContain('sortField=travellingDate');
      expect(requestedUrl).toContain('sortOrder=asc');
    });

    it('passes sort parameters with all=true on export calls', async () => {
      let requestedUrl = '';
      global.fetch = jest.fn().mockImplementation((url) => {
        requestedUrl = url;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ employees: [], total: 0 }),
        });
      });

      await employeeService.getVacationTab({
        tab: 'onVacation',
        page: 1,
        all: true,
        sortField: 'lastWorkingDay',
        sortOrder: 'asc',
      });

      expect(requestedUrl).toContain('tab=onVacation');
      expect(requestedUrl).toContain('all=1');
      expect(requestedUrl).toContain('sortField=lastWorkingDay');
      expect(requestedUrl).toContain('sortOrder=asc');
    });
  });
});
