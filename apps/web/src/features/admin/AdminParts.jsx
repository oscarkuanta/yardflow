import { Button } from '../../components/Button.jsx';
import { Dialog, ErrorNote } from '../../components/Overlay.jsx';
import { StatusChip } from '../../components/StatusChip.jsx';
import { fieldErrors } from '../../lib/api.js';

export function ActiveChip({ isActive }) {
  return (
    <StatusChip label={isActive ? 'Active' : 'Inactive'} tone={isActive ? 'accent' : 'neutral'} />
  );
}

export function FormDialog({ title, formId, mutation, onClose, onSubmit, children }) {
  const errors = fieldErrors(mutation.error);
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children(errors)}
        <div className="sm:col-span-2">
          {Object.keys(errors).length === 0 && <ErrorNote error={mutation.error} />}
        </div>
      </form>
    </Dialog>
  );
}
