import json

def main():
    with open("./tabler.json", 'r') as in_file:
        raw_data = json.load(in_file)

        with open("./consts.ts", 'a+') as out_file:
            for key, body in raw_data.items():
                split_key: list[str] = key.split('-')
                split_key = list(map(lambda key: key.title(), split_key))
                final_key = f"Tabler{''.join(split_key)}"

                svg_path = body.get("body", "").replace('\\', '')
                if not svg_path:
                    continue
                
                content = f"export const {final_key}: IconContent = `{svg_path}`;\n"
                out_file.write(content)
                
if __name__ == "__main__":
    main()
