# DinD sidecar for Petal with fuse-overlayfs: the stock docker:27-dind only
# offers vfs on top of an overlayfs host (overlay2-on-overlay is rejected), and
# vfs deep-copies every image layer — a 646MB image balloons to >8Gi on disk
# and extracts ~15x slower (this evicted the pod back in the Dagger-engine
# days). fuse-overlayfs layers properly on any fs.
FROM docker:27-dind
RUN apk add --no-cache fuse-overlayfs fuse
