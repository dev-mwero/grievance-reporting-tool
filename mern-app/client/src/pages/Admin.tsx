import { useState } from 'react';
import UsersManagement from './admin/UsersManagement';
import CategoriesManagement from './admin/CategoriesManagement';
import SubCountiesManagement from './admin/SubCountiesManagement';
import WardsManagement from './admin/WardsManagement';
import InvitationsManagement from './admin/InvitationsManagement';

type Tab = 'users' | 'invitations' | 'categories' | 'sub-counties' | 'wards';

const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'invitations', label: 'Invitations' },
  { id: 'categories', label: 'Categories' },
  { id: 'sub-counties', label: 'Sub-Counties' },
  { id: 'wards', label: 'Wards' },
];

export default function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>('users');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Administration</h1>

      <div className="flex gap-2 border-b overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && <UsersManagement />}
      {activeTab === 'invitations' && <InvitationsManagement />}
      {activeTab === 'categories' && <CategoriesManagement />}
      {activeTab === 'sub-counties' && <SubCountiesManagement />}
      {activeTab === 'wards' && <WardsManagement />}
    </div>
  );
}
