"""Static guard for the shared Feed / Profile / Detail media layout."""
from pathlib import Path

root=Path("apps/web/src")
css=(root/"styles/post-media.css").read_text()
main=(root/"main.jsx").read_text()
feed=(root/"features/feed/FeedPage.jsx").read_text()
media=(root/"features/feed/PostMedia.jsx").read_text()
entry=(root/"style.css").read_text()
assert "post-media.css" in entry
assert 'className="zs-post-media zs-post-media--profile"' in main
assert "<PostMedia src={post.mediaUrl}" in feed
assert 'className=\'zs-post-media\'' in media
assert ".zs-post-media img" in css and ".zs-post-media video" in css
assert "max-width: 100%" in css and "object-fit: contain" in css
assert "background: transparent" in css
print("Shared responsive media contract OK")
