import os
import codecs

# 定位到你的前端文件夹
frontend_dir = './frontend'
# 需要检查的文件后缀名
extensions_to_check = ('.json', '.js', '.ts', '.tsx', '.html', '.css', '.cjs', '.mjs')

def remove_bom():
    count = 0
    for root, dirs, files in os.walk(frontend_dir):
        # 跳过 node_modules 这种庞大的第三方库文件夹
        if 'node_modules' in root:
            continue
            
        for file in files:
            if file.endswith(extensions_to_check):
                filepath = os.path.join(root, file)
                
                # 以二进制只读模式打开，检查头几个字节
                with open(filepath, 'rb') as f:
                    raw_bytes = f.read()
                
                # 如果发现了 UTF-8 BOM 特征码 (\xef\xbb\xbf)
                if raw_bytes.startswith(codecs.BOM_UTF8):
                    # 重新以二进制写入模式打开，切掉开头的 3 个字节
                    with open(filepath, 'wb') as f:
                        f.write(raw_bytes[len(codecs.BOM_UTF8):])
                    print(f"✅ 已修复: {filepath}")
                    count += 1
                    
    print(f"\n🎉 扫描完毕！共修复了 {count} 个带 BOM 的文件。")

if __name__ == '__main__':
    remove_bom()