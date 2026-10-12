#!/usr/bin/env python3
"""Собирает resources/app/playersrc.js: рантайм игры (tools/player.src.js) + код отрисовки текста и градиента из редактора.
Запускать после правок player.src.js, text.js или gradient.js:   python3 tools/build_player.py"""
import json, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
app = os.path.join(root, 'resources', 'app')
rd = lambda p: open(os.path.join(app, p) if not p.startswith('/') else p, encoding='utf-8').read()

def cut(src, start, end):
    a = src.index(start); b = src.index(end)
    return src[a:b]

text = cut(rd('text.js'), "const DEF=", "/* ---------- Inspector")
grad = cut(rd('gradient.js'), "const clamp=", "/* ---------- Inspector")
player = open(os.path.join(root, 'tools', 'player.src.js'), encoding='utf-8').read()
player = player.replace('/*@TEXT*/', '{\n' + text + '\n}').replace('/*@GRADIENT*/', '{\n' + grad + '\n}')
out = '/* АВТОГЕНЕРАЦИЯ: tools/build_player.py. Исходник рантайма — tools/player.src.js */\nwindow.PLAYER_SRC=' + json.dumps(player, ensure_ascii=False) + ';\n'
open(os.path.join(app, 'playersrc.js'), 'w', encoding='utf-8').write(out)
print('playersrc.js:', len(player), 'chars')
