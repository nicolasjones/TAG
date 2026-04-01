import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import App from './App';
import React from 'react';
import '@testing-library/jest-dom';

// Mock global fetch
global.fetch = vi.fn((url) => {
  if (url.includes('/workflows')) {
    return Promise.resolve({
      json: () => Promise.resolve([{ name: 'test_wf', label: 'Test Workflow' }]),
    });
  }
  if (url.includes('/schedules')) {
    return Promise.resolve({
      json: () => Promise.resolve([]),
    });
  }
  return Promise.reject(new Error('Unknown API'));
});

test('renders dashboard title', async () => {
  render(<App />);
  const titleElement = screen.getByText(/TAG AUTOMATION DASHBOARD/i);
  expect(titleElement).toBeInTheDocument();
});

test('fetches and displays workflows', async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
  });
});
