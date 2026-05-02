import sys

with open('src/pages/CourierPanel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("onClick={() => handleAction(currentNotification.order_type === 'open' ? 'offer' : 'accept', currentNotification.order_id)}", "onClick={() => handleAction('accept', currentNotification.order_id)}")
content = content.replace("{currentNotification.order_type === 'open' ? 'Ofertar' : 'Aceptar'}", "Aceptar")
content = content.replace("onClick={() => handleAction(order.order_type === 'open' ? 'offer' : 'accept', order.id)}", "onClick={() => handleAction('accept', order.id)}")
content = content.replace("{order.order_type === 'open' ? 'Enviar oferta' : 'Aceptar'}", "Aceptar")

with open('src/pages/CourierPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
