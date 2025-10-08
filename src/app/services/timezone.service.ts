import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TimezoneService {
  // Common timezone mappings
  private timezones: { [key: string]: string } = {
    'IST': 'Asia/Kolkata',
    'EST': 'America/New_York',
    'PST': 'America/Los_Angeles',
    'UTC': 'UTC',
    'GMT': 'Europe/London'
  };

  constructor() { }

  /**
   * Format a date/time in the user's timezone (simple and clean display)
   */
  formatInUserTimezone(date: Date, userTimezone: string): string {
    const tz = this.timezones[userTimezone] || userTimezone;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }

  /**
   * Convert a date/time from one timezone to another
   */
  convertTimezone(date: Date, fromTimezone: string, toTimezone: string): Date {
    const fromTz = this.timezones[fromTimezone] || fromTimezone;
    const toTz = this.timezones[toTimezone] || toTimezone;

    // Create a date string in the source timezone
    const dateInSourceTz = new Date(date.toLocaleString('en-US', { timeZone: fromTz }));
    const dateInTargetTz = new Date(date.toLocaleString('en-US', { timeZone: toTz }));
    
    // Calculate the offset difference
    const offset = dateInSourceTz.getTime() - dateInTargetTz.getTime();
    
    // Apply the offset to get the correct time in target timezone
    return new Date(date.getTime() - offset);
  }

  /**
   * Format a date for display in a specific timezone
   */
  formatInTimezone(date: Date, timezone: string, options?: Intl.DateTimeFormatOptions): string {
    const tz = this.timezones[timezone] || timezone;
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    };
    
    return date.toLocaleString('en-US', { 
      ...defaultOptions, 
      ...options, 
      timeZone: tz 
    });
  }

  /**
   * Get the user's current timezone
   */
  getUserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Create a UTC date from local time and timezone
   */
  createUTCFromLocalTime(localTime: string, date: Date, timezone: string): Date {
    const tz = this.timezones[timezone] || timezone;
    const [hours, minutes] = localTime.split(':').map(Number);
    
    // Create a date in the specified timezone
    const localDate = new Date(date);
    localDate.setHours(hours, minutes, 0, 0);
    
    // Convert to UTC by getting the timezone offset
    const tempDate = new Date(localDate.toLocaleString('en-US', { timeZone: tz }));
    const offset = localDate.getTime() - tempDate.getTime();
    
    return new Date(localDate.getTime() + offset);
  }

  /**
   * Get available timezones
   */
  getAvailableTimezones(): { code: string, name: string, timezone: string }[] {
    return [
      { code: 'IST', name: 'India Standard Time', timezone: 'Asia/Kolkata' },
      { code: 'EST', name: 'Eastern Standard Time', timezone: 'America/New_York' },
      { code: 'PST', name: 'Pacific Standard Time', timezone: 'America/Los_Angeles' },
      { code: 'UTC', name: 'Coordinated Universal Time', timezone: 'UTC' },
      { code: 'GMT', name: 'Greenwich Mean Time', timezone: 'Europe/London' }
    ];
  }
}