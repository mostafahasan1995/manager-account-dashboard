import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderPlain } from '@/test/utils';

import { MinorAmount, MoneyAmount } from './money-amount';

const money = { minor: '150000', amount: '1500.00', currency: 'NSP' };

describe('MoneyAmount', () => {
  it('renders the grouped amount with its currency', () => {
    renderPlain(<MoneyAmount money={money} />);
    expect(screen.getByTestId('money')).toHaveTextContent('1,500.00 NSP');
  });

  it('renders an em dash for a missing amount — never a fabricated zero', () => {
    renderPlain(<MoneyAmount money={null} />);
    expect(screen.getByTestId('money')).toHaveTextContent('—');
  });

  it('uses tabular figures so columns of money line up digit for digit', () => {
    renderPlain(<MoneyAmount money={money} />);
    expect(screen.getByTestId('money')).toHaveClass('tabular');
  });

  it('can drop the currency for a column that already names it', () => {
    renderPlain(<MoneyAmount money={money} withCurrency={false} />);
    expect(screen.getByTestId('money')).toHaveTextContent('1,500.00');
    expect(screen.getByTestId('money')).not.toHaveTextContent('NSP');
  });

  it('renders a huge amount exactly, past what a double could hold', () => {
    renderPlain(
      <MoneyAmount
        money={{ minor: '9007199254740993', amount: '90071992547409.93', currency: 'NSP' }}
      />,
    );
    expect(screen.getByTestId('money')).toHaveTextContent('90,071,992,547,409.93 NSP');
  });
});

describe('MinorAmount', () => {
  it('formats bare minor units', () => {
    renderPlain(<MinorAmount minor="150000" />);
    expect(screen.getByText('1,500.00')).toBeInTheDocument();
  });

  it('adds the currency when the row knows it', () => {
    renderPlain(<MinorAmount minor="150000" currency="NSP" />);
    expect(screen.getByText('1,500.00 NSP')).toBeInTheDocument();
  });

  it('signs a positive delta and colours it as a gain', () => {
    const { container } = renderPlain(<MinorAmount minor="6250000" signed />);
    expect(screen.getByText('+62,500.00')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('success');
  });

  it('colours a negative delta as a loss, which is the one that costs money', () => {
    const { container } = renderPlain(<MinorAmount minor="-6250000" signed />);
    expect(screen.getByText('-62,500.00')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('danger');
  });

  it('renders an em dash when there is no figure at all', () => {
    renderPlain(<MinorAmount minor={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
