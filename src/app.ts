/**
 * app.ts - Minimal application entry point
 * Initializes the AppController and starts the application
 */
import { AppController } from './core/AppController';
import './ui/pipelineEditorIntegration';
import './ui/rerollEditorIntegration';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  
  app.init().catch(error => {
    console.error('[App] Failed to initialize:', error);
    alert('Application failed to initialize. Please refresh the page.');
  });

  // Make app available globally for debugging
  (window as any).__warcrowApp = app;
});

