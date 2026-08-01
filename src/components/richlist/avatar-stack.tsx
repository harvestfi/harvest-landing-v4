// Overlapping holder marks, used beside a group label in the who-holds-what
// breakdown.
//
// Icons only, no names: the row already says what the group is, and the stack
// is there to show at a glance that "Known exchanges" is a dozen venues while
// "Ripple founders" is two. Reading it is a bonus rather than the point, which
// is why the whole thing is hidden from assistive tech and the row's own text
// carries the meaning.
//
// Marks are laid right-to-left in the DOM so the leftmost, which belongs to
// the largest holder in the group, paints on top. Done with flex-direction
// rather than z-index per item, so adding a mark cannot quietly break the
// stacking order.

import Image from "next/image";
import { holderAvatar } from "./holder-avatars";

// Past this the stack stops reading as a set of faces and starts reading as a
// smudge, and the row still has three numeric columns to fit beside it.
const MAX_SHOWN = 6;

export function AvatarStack({ names }: { names: string[] }) {
  const marks = names.map((n) => ({ n, src: holderAvatar(n) })).filter((m) => m.src);
  if (!marks.length) return null;
  const shown = marks.slice(0, MAX_SHOWN);
  const rest = marks.length - shown.length;

  return (
    <span className="rl-avstack" aria-hidden="true">
      {/* Reversed here, and reversed again in CSS, so the first mark ends up
          leftmost and on top. */}
      {[...shown].reverse().map((m) => (
        <Image
          key={m.n}
          className="rl-avstack-img"
          src={m.src!}
          alt=""
          width={16}
          height={16}
        />
      ))}
      {rest > 0 ? <span className="rl-avstack-more">+{rest}</span> : null}
    </span>
  );
}
