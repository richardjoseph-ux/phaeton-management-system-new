import { useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import BillingStatementPDF from '@/components/billing/BillingStatementPDF';
import BillingStatementPDFDelivery from '@/components/billing/BillingStatementPDFDelivery';
import BillingStatementPDFSummary from '@/components/billing/BillingStatementPDFSummary';
import Quotation from '@/components/billing/Quotation';

export default function Accounting() {
  const [tab, setTab] = useState('statement');

  const tabClass = (active) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="p-6">
      <PageHeader title="Accounting" subtitle="Billing statement generation and accounting tools" />

      <div className="flex flex-wrap items-center gap-2 border-b mb-6">
        <button onClick={() => setTab('statement')} className={tabClass(tab === 'statement')}>
          Top Sheet (Shuttle)
        </button>
        <button onClick={() => setTab('delivery')} className={tabClass(tab === 'delivery')}>
          Top Sheet (Delivery)
        </button>
        <button onClick={() => setTab('summary')} className={tabClass(tab === 'summary')}>
          Top Sheet (Summary)
        </button>
        <button onClick={() => setTab('quotation')} className={tabClass(tab === 'quotation')}>
          Quotation
        </button>
      </div>

      {tab === 'statement' && <BillingStatementPDF />}
      {tab === 'delivery' && <BillingStatementPDFDelivery />}
      {tab === 'summary' && <BillingStatementPDFSummary />}
      {tab === 'quotation' && <Quotation />}
    </div>
  );
}