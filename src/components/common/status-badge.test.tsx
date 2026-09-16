import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderPlain } from '@/test/utils';
import { DEPOSIT_STATUSES, PLAYER_STATUSES } from '@/types/enums';

import { RiskFlagList, RiskIndicator, SeverityBadge } from './risk-flags';
import {
  ActiveBadge,
  BreakStatusBadge,
  DepositStatusBadge,
  PlayerStatusBadge,
  RoleBadge,
  TenantStatusBadge,
} from './status-badge';

/**
 * The rule these enforce: status is a WORD plus a colour, never a colour alone, and a value the
 * backend adds tomorrow still renders as itself instead of vanishing.
 */

describe('DepositStatusBadge', () => {
  it('renders a readable label rather than the raw enum', () => {
    renderPlain(<DepositStatusBadge status="PENDING_SECOND_APPROVAL" />);
    expect(screen.getByText('Second approval')).toBeInTheDocument();
  });

  it('has a label for every status the backend can send', () => {
    for (const status of DEPOSIT_STATUSES) {
      const { unmount } = renderPlain(<DepositStatusBadge status={status} />);
      expect(screen.getByText(/\w/)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders an unknown status as itself instead of blank', () => {
    renderPlain(<DepositStatusBadge status="SOME_NEW_STATUS" />);
    expect(screen.getByText('Some new status')).toBeInTheDocument();
  });
});

describe('PlayerStatusBadge', () => {
  it('spells out the status that costs money', () => {
    renderPlain(<PlayerStatusBadge status="PENDING_ICHANCY" />);
    expect(screen.getByText('Pending Ichancy')).toBeInTheDocument();
  });

  it('covers every player status', () => {
    for (const status of PLAYER_STATUSES) {
      const { unmount } = renderPlain(<PlayerStatusBadge status={status} />);
      expect(screen.getByText(/\w/)).toBeInTheDocument();
      unmount();
    }
  });
});

describe('BreakStatusBadge and TenantStatusBadge', () => {
  it('label their statuses', () => {
    renderPlain(<BreakStatusBadge status="WRITTEN_OFF" />);
    expect(screen.getByText('Written off')).toBeInTheDocument();
  });

  it('labels a tenant status', () => {
    renderPlain(<TenantStatusBadge status="SUSPENDED" />);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });
});

describe('RoleBadge', () => {
  it('names the role', () => {
    renderPlain(<RoleBadge role="FINANCE_ADMIN" />);
    expect(screen.getByText('Finance admin')).toBeInTheDocument();
  });

  it('renders PLATFORM_ADMIN distinctly, because it is not a bigger SUPER_ADMIN', () => {
    const { container } = renderPlain(<RoleBadge role="PLATFORM_ADMIN" />);
    const platform = container.querySelector('span')?.className;

    renderPlain(<RoleBadge role="SUPER_ADMIN" />);
    expect(screen.getByText('Super admin')).toBeInTheDocument();
    expect(platform).not.toBe(screen.getByText('Super admin').className);
  });
});

describe('ActiveBadge', () => {
  it('says "Deactivated" rather than "Deleted", because nothing here is ever deleted', () => {
    renderPlain(<ActiveBadge isActive={false} />);
    expect(screen.getByText('Deactivated')).toBeInTheDocument();
  });

  it('says Active when it is', () => {
    renderPlain(<ActiveBadge isActive />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

describe('RiskFlagList', () => {
  it('translates each flag and puts the worst one first', () => {
    renderPlain(<RiskFlagList flags={['NEW_PLAYER', 'DUPLICATE_PROOF_EXACT']} />);

    const badges = screen.getAllByText(/player|proof/i);
    expect(badges[0]).toHaveTextContent('Identical proof already seen');
    expect(screen.getByText('New player')).toBeInTheDocument();
  });

  it('says None rather than showing an empty row', () => {
    renderPlain(<RiskFlagList flags={[]} />);
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('renders a flag it has never seen', () => {
    renderPlain(<RiskFlagList flags={['SOMETHING_NEW']} />);
    expect(screen.getByText('Something new')).toBeInTheDocument();
  });
});

describe('RiskIndicator', () => {
  it('shows nothing for a clean deposit, so flagged rows stand out', () => {
    const { container } = renderPlain(<RiskIndicator flags={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('counts the flags on a risky one', () => {
    renderPlain(<RiskIndicator flags={['NEW_PLAYER', 'LARGE_AMOUNT']} />);
    expect(screen.getByTestId('risk-indicator')).toHaveTextContent('2');
  });
});

describe('SeverityBadge', () => {
  it('says the number out loud rather than relying on colour', () => {
    renderPlain(<SeverityBadge severity={5} />);
    expect(screen.getByText('Severity 5')).toBeInTheDocument();
  });
});
