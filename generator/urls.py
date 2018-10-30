# -*- coding: utf-8 -*-
"""
-------------------------------------------------
   File Name：     urls
   Description :
   Author :       zdf's desktop
   date：          2018/10/29
-------------------------------------------------
   Change Activity:
                   2018/10/29:20:07
-------------------------------------------------
"""
from django.conf import settings
from django.urls import path
from django.conf.urls.static import static
from . import views

urlpatterns = [
    path('', views.index),
]