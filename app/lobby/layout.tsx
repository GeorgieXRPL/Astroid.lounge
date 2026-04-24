/**
 * Wraps every route under /lobby/* in the self-attestation gate.
 *
 * Why a layout and not a page-level wrapper:
 *   The gate's job is to block render of the lobby (and future child
 *   routes like /lobby/[tournamentId]) until attestation is on record.
 *   Putting it in the layout ensures any future nested page inherits
 *   the gate without an additional opt-in.
 */
import { AgeJurisdictionGate } from '../components/AgeJurisdictionGate';

export default function LobbyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AgeJurisdictionGate>{children}</AgeJurisdictionGate>;
}
