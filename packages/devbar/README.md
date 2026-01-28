# @ytspar/devbar

Development toolbar and utilities with Sweetlink integration.

## Features

- **GlobalDevBar**: Lightweight dev bar for all pages with breakpoint info, Sweetlink status, and performance stats
- **DevToolbar**: Advanced toolbar for debugging and layout controls
- **DevBarContext**: Context provider for dynamic dev bar controls
- **DevLayoutContext**: Layout state management for development tools

## Installation

```bash
pnpm add @ytspar/devbar
```

## Usage

### GlobalDevBar (Recommended for most projects)

```tsx
import { GlobalDevBar, DevBarProvider } from '@ytspar/devbar';

function App() {
  return (
    <DevBarProvider>
      <GlobalDevBar />
      {/* Your app content */}
    </DevBarProvider>
  );
}
```

### DevToolbar (For grid debugging)

```tsx
import { DevToolbar, DevBarProvider } from '@ytspar/devbar';

function GridPage() {
  return (
    <DevBarProvider>
      <DevToolbar />
      {/* Grid content */}
    </DevBarProvider>
  );
}
```

### Adding Custom Controls

```tsx
import { useDevBar } from '@ytspar/devbar';

function MyComponent() {
  const { setContextControls } = useDevBar();

  useEffect(() => {
    setContextControls([
      {
        label: 'Reset State',
        onClick: () => console.log('Reset'),
        variant: 'warning'
      }
    ]);
  }, []);

  return <div>My Component</div>;
}
```

## Dependencies

- `react` ^18.0.0 (peer dependency)
- `html2canvas-pro` - For screenshot capture
- `axe-core` - For accessibility testing

## Integration with Sweetlink

GlobalDevBar automatically connects to the Sweetlink WebSocket server when running in development mode, providing:

- Real-time connection status
- Screenshot capture integration
- Console log monitoring
- Performance metrics

### Early Console Capture

To capture console logs **before** React hydrates (critical for catching hydration errors), inject the early capture script into your HTML head. See the source code for usage examples.

The script captures:
- All `console.log/error/warn/info` calls
- Uncaught exceptions (`window.error` events)
- Unhandled promise rejections
- Error objects with full stack traces (properly serialized)

GlobalDevBar automatically merges these early logs when it mounts.

## License

MIT
