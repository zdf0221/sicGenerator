# -*- coding: utf-8 -*-
"""
-------------------------------------------------
   File Name：     request
   Description :
   Author :       zdf's desktop
   date：          2018/10/29
-------------------------------------------------
   Change Activity:
                   2018/10/29:21:51
-------------------------------------------------
"""
import requests

if __name__ == "__main__":
    url = 'https://api.ampermusic.com/v1/login'
    header = {
        "Host": "api.ampermusic.com",
        "Content-Type": "application/vnd.api+json",
        # "Authorization": "zdf0221 hOIPuBONLyWcuvkjSVi12KU0ZQIfLZlRmwOZDc4Z3M7WLiAIVBRL153xmkwUIsvs"
    }
    body = {
        "data": {
            "type": "login",
            "attributes": {
                "email_address": "zdf.usa@gmail.com",
                "password": "Creative"
            }
        }
    }
    # r = requests.get("http://www.baidu.com")
    r = requests.post(url, json=body, headers=header)
    print(r.text)