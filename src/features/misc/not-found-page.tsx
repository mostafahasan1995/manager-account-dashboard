import { Link } from '@tanstack/react-router';
import { Compass } from 'lucide-react';

import { EmptyState } from '@/components/common/states';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<Compass className="size-5" />}
        title="That page does not exist"
        description="The link may be out of date, or the screen may need a role you do not have."
        action={
          <Button asChild variant="primary" size="sm">
            <Link to="/">Back to the overview</Link>
          </Button>
        }
      />
    </div>
  );
}
