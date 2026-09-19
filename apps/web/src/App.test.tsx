import { PAPEROS_VERSION } from '@paperos/core';
import { TEMPLATE_TITLE } from '@paperos/ui';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('placeholder route', () => {
  it('renders the template title inside a level-1 heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(TEMPLATE_TITLE);
  });

  it('renders the build commit from VITE_GIT_SHA', () => {
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent(import.meta.env.VITE_GIT_SHA);
  });

  it('exposes a banner and a main landmark', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('resolves workspace packages through the @paperos/* alias', () => {
    expect(PAPEROS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
