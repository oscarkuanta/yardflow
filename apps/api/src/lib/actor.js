export function actorOf(request) {
  return { id: request.user.id, ip: request.ip };
}
