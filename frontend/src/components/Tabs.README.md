# Tabs Component

A fully accessible tabs component with keyboard navigation, multiple variants, and flexible orientation support.

## Features

- ✅ Fully accessible with ARIA attributes
- ✅ Keyboard navigation (Arrow keys, Home, End)
- ✅ Multiple variants (default, pills, underline)
- ✅ Horizontal and vertical orientation
- ✅ Controlled and uncontrolled modes
- ✅ Disabled tabs support
- ✅ Icon support
- ✅ Responsive design
- ✅ Light/dark mode support

## Basic Usage

```tsx
import { Tabs, Tab } from './components';

const tabs: Tab[] = [
  {
    id: 'tab1',
    label: 'Overview',
    content: <div>Overview content</div>,
  },
  {
    id: 'tab2',
    label: 'Details',
    content: <div>Details content</div>,
  },
];

function MyComponent() {
  return <Tabs tabs={tabs} />;
}
```

## Props

### Tabs Component

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabs` | `Tab[]` | required | Array of tab objects |
| `defaultTab` | `string` | first tab id | Initial active tab (uncontrolled) |
| `activeTab` | `string` | - | Active tab (controlled) |
| `onChange` | `(tabId: string) => void` | - | Callback when tab changes |
| `variant` | `'default' \| 'pills' \| 'underline'` | `'default'` | Visual style variant |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Tab list orientation |
| `className` | `string` | `''` | Additional CSS classes |

### Tab Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier |
| `label` | `string` | ✅ | Tab label text |
| `content` | `React.ReactNode` | ✅ | Tab panel content |
| `disabled` | `boolean` | ❌ | Disable the tab |
| `icon` | `React.ReactNode` | ❌ | Icon element |

## Examples

### With Icons

```tsx
const tabs: Tab[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <HomeIcon />,
    content: <HomePage />,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <SettingsIcon />,
    content: <SettingsPage />,
  },
];

<Tabs tabs={tabs} />
```

### Pills Variant

```tsx
<Tabs tabs={tabs} variant="pills" />
```

### Vertical Orientation

```tsx
<Tabs tabs={tabs} orientation="vertical" />
```

### Controlled Mode

```tsx
function ControlledTabs() {
  const [activeTab, setActiveTab] = useState('tab1');

  return (
    <Tabs
      tabs={tabs}
      activeTab={activeTab}
      onChange={setActiveTab}
    />
  );
}
```

### With Disabled Tab

```tsx
const tabs: Tab[] = [
  { id: 'tab1', label: 'Active', content: <div>Content</div> },
  { id: 'tab2', label: 'Disabled', content: <div>Content</div>, disabled: true },
];

<Tabs tabs={tabs} />
```

## Keyboard Navigation

The component supports full keyboard navigation following WAI-ARIA best practices:

- **Arrow Right/Down**: Move to next tab
- **Arrow Left/Up**: Move to previous tab
- **Home**: Move to first tab
- **End**: Move to last tab
- **Tab**: Move focus to active tab panel

Disabled tabs are automatically skipped during keyboard navigation.

## Accessibility

The component implements ARIA tab pattern:

- `role="tablist"` on the tab container
- `role="tab"` on each tab button
- `role="tabpanel"` on the content area
- `aria-selected` indicates active tab
- `aria-controls` links tab to panel
- `aria-labelledby` links panel to tab
- `aria-disabled` for disabled tabs
- Proper `tabindex` management for keyboard navigation

## Styling

The component uses CSS classes that can be customized:

- `.tabs` - Root container
- `.tabs-list` - Tab list container
- `.tabs-trigger` - Individual tab button
- `.tabs-trigger-active` - Active tab
- `.tabs-trigger-disabled` - Disabled tab
- `.tabs-content` - Content panel
- `.tabs-{variant}` - Variant-specific styles
- `.tabs-{orientation}` - Orientation-specific styles

## Responsive Behavior

- Horizontal tabs: Scrollable on small screens
- Vertical tabs: Automatically switch to horizontal on mobile (<768px)
- Touch-friendly tap targets
- Optimized for mobile interactions

## Browser Support

Works in all modern browsers that support:
- CSS Flexbox
- ES6+ JavaScript
- React 18+
