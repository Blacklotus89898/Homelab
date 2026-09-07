# DinD sidecar for Petal with fuse-overlayfs: the stock docker:27-dind only
# offers vfs on top of an overlayfs host (overlay2-on-overlay is rejected), and
# vfs deep-copies every image layer — the Dagger engine ballooned from 646MB
# to >8Gi and evicted the pod. fuse-overlayfs layers properly on any fs.
FROM docker:27-dind
RUN apk add --no-cache fuse-overlayfs fuse
