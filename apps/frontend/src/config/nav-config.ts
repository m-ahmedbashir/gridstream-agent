import { NavItem } from '@/types';

/**
 * Navigation configuration
 * Used by sidebar and Cmd+K bar.
 */
export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard/overview',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: []
  },
  {
    title: 'Product',
    url: '/dashboard/product',
    icon: 'product',
    shortcut: ['p', 'p'],
    isActive: false,
    items: []
  },
  {
    title: 'Upload Invoices',
    url: '/dashboard/upload',
    icon: 'upload',
    shortcut: ['u', 'i'],
    isActive: false,
    items: []
  },
  {
    title: 'Maintenance',
    url: '/dashboard/maintenance',
    icon: 'settings',
    shortcut: ['m', 'm'],
    isActive: false,
    items: [
      {
        title: 'Upload Report',
        url: '/dashboard/maintenance',
      },
      {
        title: 'Measures',
        url: '/dashboard/maintenance/measures',
      },
      {
        title: 'Plan',
        url: '/dashboard/maintenance/plan',
      },
      {
        title: 'History',
        url: '/dashboard/maintenance/history',
      }
    ]
  },
  {
    title: 'AI Assistant',
    url: '/dashboard/chat',
    icon: 'robot',
    shortcut: ['c', 'c'],
    isActive: false,
    items: []
  },
  {
    title: 'Settings',
    url: '/dashboard/extraction-settings',
    icon: 'settings',
    shortcut: ['s', 's'],
    isActive: false,
    items: []
  },
  {
    title: 'Account',
    url: '#',
    icon: 'account',
    isActive: true,
    items: [
      {
        title: 'Login',
        shortcut: ['l', 'l'],
        url: '/',
        icon: 'login'
      }
    ]
  }
];
