# 🚀 Guia Rápido de Uso

## Para o Cliente (Usuário Final)

### Como fazer um pedido:

1. **Acesse o cardápio**: Abra `index.html` no navegador
2. **Navegue pelas categorias**: Clique nas categorias no topo para filtrar
3. **Adicione produtos**: Clique em "Adicionar" nos produtos desejados
4. **Abra o carrinho**: Clique no ícone do carrinho no canto superior direito
5. **Ajuste quantidades**: Use os botões + e - para ajustar
6. **Finalize**: Clique em "Finalizar Pedido"
7. **Anote o número**: Guarde o número do pedido para retirada
8. **Pague no balcão**: O pagamento é feito presencialmente

## Para o Administrador (Dono do Restaurante)

### Primeiro Acesso:

1. **Acesse o painel**: Abra `admin.html` no navegador
2. **Faça login**: Use as credenciais criadas no Firebase
   - E-mail: `admin@cardapio.com`
   - Senha: sua senha definida

### Gerenciar Categorias:

1. Clique em **"Categorias"** no menu lateral
2. Clique em **"+ Nova Categoria"**
3. Digite o nome (ex: "Pizzas", "Bebidas", "Sobremesas")
4. Clique em **"Salvar"**

### Adicionar Produtos:

1. Clique em **"Produtos"** no menu lateral
2. Clique em **"+ Novo Produto"**
3. Preencha os dados:
   - Nome do produto
   - Preço (use ponto para decimais: 35.90)
   - Categoria (selecione uma existente)
   - Descrição (opcional)
   - Imagem (clique em "Choose File")
   - Marque "Produto ativo" para exibir no cardápio
4. Clique em **"Salvar"**

### Editar Produtos:

1. Vá em **"Produtos"**
2. Clique em **"Editar"** no produto desejado
3. Altere os dados necessários
4. Clique em **"Salvar"**

### Alterar Preço:

1. Clique em **"Editar"** no produto
2. Altere apenas o campo **"Preço"**
3. Clique em **"Salvar"**
4. A mudança é instantânea para todos os clientes!

### Ativar/Desativar Produto:

1. Clique em **"Editar"** no produto
2. Desmarque **"Produto ativo"** para ocultar do cardápio
3. Marque **"Produto ativo"** para exibir novamente
4. Clique em **"Salvar"**

### Trocar Imagem:

1. Clique em **"Editar"** no produto
2. Clique em **"Choose File"** e selecione nova imagem
3. Clique em **"Salvar"**
4. Recomendado: imagens com proporção 4:3 ou 16:9

### Gerenciar Pedidos:

1. Clique em **"Pedidos"** no menu lateral
2. Veja todos os pedidos em tempo real
3. Use os filtros: **Todos**, **Novos**, **Preparando**, **Prontos**

### Atualizar Status dos Pedidos:

1. Vá em **"Pedidos"**
2. Para pedidos novos: Clique em **"Preparando"**
3. Para pedidos em preparo: Clique em **"Pronto"**
4. O cliente pode acompanhar o status

### Excluir Produto ou Categoria:

1. Clique no botão de **lixeira** (ícone vermelho)
2. Confirme a exclusão
3. **Atenção**: Esta ação não pode ser desfeita!

## Dicas Importantes:

### Para Melhor Performance:

- Use imagens otimizadas (máximo 500KB por imagem)
- Recomendado: 800x600 pixels
- Formatos: JPG, PNG, WEBP

### Para Melhor Organização:

- Crie categorias antes de adicionar produtos
- Use descrições curtas e objetivas
- Mantenha nomes de produtos claros

### Segurança:

- **NUNCA compartilhe suas credenciais de login**
- Faça logout quando terminar de usar o painel
- Em produção, use regras de segurança do Firebase

### Backup:

- Faça backup periódico dos dados no Firebase Console
- Salve as imagens importantes localmente

## Acesso por QR Code (Recomendado):

Para facilitar o acesso dos clientes:

1. Gere um QR Code da URL do seu cardápio
2. Use sites como: qr-code-generator.com
3. Imprima e coloque nas mesas
4. Clientes escaneiam e acessam direto!

## Suporte Técnico:

### Problemas Comuns:

**Produto não aparece no cardápio:**
- Verifique se está marcado como "ativo"
- Verifique se a categoria existe

**Erro ao fazer upload de imagem:**
- Verifique o tamanho (máx 5MB)
- Verifique o formato (JPG, PNG, WEBP)
- Verifique sua conexão com internet

**Pedidos não aparecem:**
- Verifique sua conexão com internet
- Atualize a página (F5)
- Verifique o Firebase Console

## Recursos Avançados:

### Horários Especiais:
- Desative produtos fora do horário (ex: café da manhã à tarde)
- Ative novamente quando disponível

### Promoções:
- Edite o preço para aplicar desconto
- Adicione "(Promoção!)" no nome do produto
- Descreva a promoção na descrição

### Pedidos para Viagem:
- Use o mesmo sistema
- Acompanhe o status em tempo real
- Chame o cliente quando estiver pronto

---

**Dúvidas?** Consulte o README.md completo para informações técnicas detalhadas.
