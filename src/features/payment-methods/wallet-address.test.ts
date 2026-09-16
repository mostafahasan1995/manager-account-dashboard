import { describe, expect, it } from 'vitest';

import { chainAddressProblem, detectWalletNetwork, isWalletAddress } from './wallet-address';

/** Tether's own contracts — real, well-formed addresses on each chain. */
const TRON = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const EVM = '0x55d398326f99059ff775485246999027b3197955';

describe('recognising an address', () => {
  it('accepts each address on its own chain', () => {
    expect(isWalletAddress('TRC20', TRON)).toBe(true);
    expect(isWalletAddress('BEP20', EVM)).toBe(true);
  });

  it('REFUSES each on the other chain', () => {
    expect(isWalletAddress('TRC20', EVM)).toBe(false);
    expect(isWalletAddress('BEP20', TRON)).toBe(false);
  });

  it('refuses the base58 characters that exist to prevent misreading', () => {
    // 0/O and I/l are excluded from base58 precisely because people confuse them, so an address
    // containing one is not a Tron address — it is somebody's misreading of one.
    for (const confusable of ['0', 'O', 'I', 'l']) {
      expect(isWalletAddress('TRC20', `T${confusable}${TRON.slice(2)}`)).toBe(false);
    }
  });

  it('refuses an address of the wrong length in either direction', () => {
    expect(isWalletAddress('TRC20', TRON.slice(0, -1))).toBe(false);
    expect(isWalletAddress('TRC20', `${TRON}x`)).toBe(false);
    expect(isWalletAddress('BEP20', EVM.slice(0, -1))).toBe(false);
    expect(isWalletAddress('BEP20', `${EVM}0`)).toBe(false);
  });

  it('refuses hex with its 0x missing, which is how an address arrives half-copied', () => {
    expect(isWalletAddress('BEP20', EVM.slice(2))).toBe(false);
  });

  it('accepts a BEP20 address in any case, because EIP-55 is not verified here', () => {
    // Said as behaviour so nobody later reads a mixed-case address as a checked one.
    expect(isWalletAddress('BEP20', EVM.toLowerCase())).toBe(true);
    expect(isWalletAddress('BEP20', `0x${EVM.slice(2).toUpperCase()}`)).toBe(true);
  });
});

describe('which chain a string is on', () => {
  it('identifies each format', () => {
    expect(detectWalletNetwork(TRON)).toBe('TRC20');
    expect(detectWalletNetwork(EVM)).toBe('BEP20');
  });

  it('says nothing about a string that is neither', () => {
    expect(detectWalletNetwork('SEED-PLACEHOLDER-USDT-TRC20-0000')).toBeNull();
    expect(detectWalletNetwork('SY84 0000 0000 0001 2345')).toBeNull();
  });

  /**
   * The bug this file was rewritten for, stated as behaviour.
   *
   * The chain used to be looked up from the method CODE, which worked only for the two codes this
   * system seeds. The first operator to make their own USDT rail called it `USDT`, and the lookup
   * answered null — so their rail was missing from the financial screen and their address was never
   * checked. Nothing here may ever take a code again.
   */
  it('reads the chain off the address, so what the operator named the rail cannot matter', () => {
    // The same two addresses an operator would paste into a method they called `USDT`, or `sham`,
    // or anything else. The answer is identical because the name was never consulted.
    expect(detectWalletNetwork(TRON)).toBe('TRC20');
    expect(detectWalletNetwork(EVM)).toBe('BEP20');
    // And a code, handed in by mistake, is not an address and never resolves to a chain.
    expect(detectWalletNetwork('USDT_TRC20')).toBeNull();
    expect(detectWalletNetwork('USDT')).toBeNull();
  });
});

describe('what the operator is told on a chain rail', () => {
  it('says nothing when a real address is pasted, on either chain', () => {
    // Either chain, because after the code table went nothing knows which one a rail is "supposed"
    // to be on — and the backend verifies each deposit against its own destination's address.
    expect(chainAddressProblem(TRON)).toBeNull();
    expect(chainAddressProblem(EVM)).toBeNull();
  });

  it('forgives the whitespace a phone paste brings with it', () => {
    expect(chainAddressProblem(`  ${TRON}\n`)).toBeNull();
  });

  it('stays quiet on an empty field, which is the blank-check rule to report', () => {
    // Two messages about one empty box is one message too many, and the other one is clearer.
    expect(chainAddressProblem('')).toBeNull();
  });

  it('refuses a bank account number pasted into a rail that pays on a chain', () => {
    expect(chainAddressProblem('SY84 0000 0000 0001 2345')).toBe('rails.validation.walletShape');
  });

  it('refuses the seed placeholder a fresh tenant starts with', () => {
    // The string that makes an unconfigured rail look configured. USDT sent to it is unrecoverable.
    expect(chainAddressProblem('SEED-PLACEHOLDER-USDT-TRC20-0000')).not.toBeNull();
  });

  it('refuses an address that arrived truncated by a bad copy', () => {
    expect(chainAddressProblem(TRON.slice(0, -1))).not.toBeNull();
    expect(chainAddressProblem(EVM.slice(2))).not.toBeNull();
  });

  it('returns a KEY, never a sentence, so both languages stay in the message bundle', () => {
    // A validator that built English text would quietly make half the console monolingual at the
    // exact point where being understood matters most.
    const problem = chainAddressProblem('my wallet');

    expect(problem?.startsWith('rails.')).toBe(true);
  });
});
