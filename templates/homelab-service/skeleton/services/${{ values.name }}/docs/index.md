# ${{ values.name }}

${{ values.description | trim }}

| Field | Value |
|---|---|
| Namespace | `${{ values.name }}` |
| Image | `${{ values.image }}` |
| URL | ${{ "https://" + values.name + ".lab.home" if values.route else "in-cluster only" }}{% if values.nodePort %} · LAN `http://192.168.0.108:${{ values.nodePort }}`{% endif %} |
| Health | `${{ values.healthPath }}` |
| Storage | ${{ values.pvcSize }}{% if values.pvcSize != "none" %} at `${{ values.dataPath }}` (rollout: Recreate){% endif %} |
{%- if values.sourceRepo %}
| Source | [${{ values.sourceRepo }}](https://github.com/${{ values.sourceRepo }}) |
{%- endif %}

## Deploy a new version

The service repo's CI pushes `:<commit sha>`. Bump `image:` in
`services/${{ values.name }}/deployment.yaml` in a PR, and ArgoCD rolls it out.

## Operations

```bash
kubectl -n argocd get app ${{ values.name }}                 # Synced / Healthy
kubectl -n ${{ values.name }} get pods,svc
kubectl -n ${{ values.name }} logs deploy/${{ values.name }} -f
```

Restarts and scaling go through git (Homelab CLAUDE.md: no live `kubectl` edits).
