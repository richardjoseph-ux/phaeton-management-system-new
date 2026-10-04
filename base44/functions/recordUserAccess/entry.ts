import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { user_id, occurred_at } = await req.json();
    if (!user_id || user.id !== user_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await base44.entities.User.update(user_id, {
      last_access: occurred_at || new Date().toISOString()
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}