# Throttling and rate limiting

Throttling and rate limiting both control API traffic to protect systems, but differ in handling excess requests. Rate limiting strictly caps requests (e.g., 100/min), rejecting extras immediately. Throttling slows down or queues requests when traffic spikes to protect server performance, providing a smoother, though slower, experience.