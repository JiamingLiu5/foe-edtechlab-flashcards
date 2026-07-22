<script lang="ts">
  import "katex/dist/katex.min.css";
  import { renderMath } from "./renderMath";

  export let text: string;
</script>

<span>{@html renderMath(text)}</span>
