# Regras de desenvolvimento - Finanças 360

## Ponto estável de parcelas
O fluxo de Parcelas de Títulos está congelado a partir do ponto de restauração:
- `_restore-points/index.20260802-estavel-parcelas.html`
- `_restore-points/visual-refinements.20260802-estavel-parcelas.css`

## Regra obrigatória para mexer em rateio
Enquanto estivermos trabalhando no motor de rateio, não alterar a lógica existente de Parcelas de Títulos.

Permitido reutilizar apenas utilitários neutros, como formatação de data, moeda, limpeza de texto e autocomplete.

Não alterar funções, filtros, chaves de de-para, conciliação, geração ou exportação do fluxo normal de parcelas sem uma solicitação explícita.

Qualquer rotina nova de rateio deve ficar isolada, com funções próprias e validação própria. O grupo em modo Parcelas de Títulos deve continuar gerando exatamente o mesmo resultado do ponto estável.

## Critério antes de publicar
Antes de subir qualquer alteração de rateio, testar um grupo normal em Parcelas de Títulos e confirmar que quantidade de lançamentos, valores, pendências e exportação final permanecem iguais ao ponto estável.

## Separação de telas
O botão `Importar planilha` deve abrir sempre o fluxo normal de Parcelas de Títulos.

O rateio CP Aromas deve ser acessado somente pelo módulo isolado `Rateio CP Aromas`, para reconstrução e testes sem misturar com a rotina estável de parcelas.
