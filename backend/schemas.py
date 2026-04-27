from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Auth Schemas
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "customer"

class UserLogin(BaseModel):
    email: str
    password: str

class SocialAuth(BaseModel):
    provider: str
    token: str
    role: str = "customer"

class Token(BaseModel):
    access_token: str
    token_type: str
    id: int
    role: str
    username: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None

# Order Schemas
class OrderRatingCreate(BaseModel):
    business_rating: int
    courier_rating: int
    comment: Optional[str] = None

class OrderItemCreate(BaseModel):
    name: str
    price: int
    quantity: int
    emoji: str

class OrderCreate(BaseModel):
    business_id: Optional[str] = None
    user_id: Optional[int] = None
    customer_name: str
    customer_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    payment_method: str = "card"
    notes: Optional[str] = None
    total: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    items: List[OrderItemCreate] = []
    order_type: str = "regular"
    origin_name: Optional[str] = None
    origin_address: Optional[str] = None
    open_order_description: Optional[str] = None
    batch_id: Optional[str] = None

class OrderResponse(BaseModel):
    id: str
    customer_name: str
    customer_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    business_id: Optional[str] = None
    total: int
    status: str
    payment_method: Optional[str] = "card"
    courier_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime
    estimated_delivery_time: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    is_rated: bool = False
    order_type: str = "regular"
    origin_name: Optional[str] = None
    origin_address: Optional[str] = None
    open_order_description: Optional[str] = None
    batch_id: Optional[str] = None

class OrderDetailResponse(OrderResponse):
    items: List[OrderItemCreate]
    logs: List[dict] = []
    courier_lat: Optional[float] = None
    courier_lng: Optional[float] = None
    courier_name: Optional[str] = None
    courier_image: Optional[str] = None
    courier_vehicle: Optional[str] = None
    courier_phone: Optional[str] = None
    courier_rating: Optional[float] = None
    business_lat: Optional[float] = None
    business_lng: Optional[float] = None

# Business Schemas
class BusinessBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    emoji: Optional[str] = "🏪"
    image_url: Optional[str] = None
    delivery_fee: int = 0
    eta: Optional[str] = "20-30 min"
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class BusinessCreate(BusinessBase):
    id: str

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    emoji: Optional[str] = None
    image_url: Optional[str] = None
    delivery_fee: Optional[int] = None
    eta: Optional[str] = None
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class BusinessResponse(BusinessBase):
    id: str
    rating: float
    status: str
    created_at: datetime

# Menu Item Schemas
class MenuItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: int
    category: Optional[str] = None
    image_url: Optional[str] = None
    emoji: Optional[str] = "🍔"
    is_active: bool = True

class MenuItemCreate(MenuItemBase):
    pass

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    emoji: Optional[str] = None
    is_active: Optional[bool] = None

class MenuItemResponse(MenuItemBase):
    id: int
    business_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Business Request Schemas
class BusinessRequestCreate(BaseModel):
    name: str
    email: str
    phone: str
    address: str
    category: str
    password: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    menu_json: Optional[List[dict]] = None

class BusinessRequestResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    address: str
    category: str
    password: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    menu_json: Optional[List[dict]] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# Order Rating Schemas
class OrderRatingCreate(BaseModel):
    business_rating: int
    courier_rating: Optional[int] = None
    comment: Optional[str] = None

# Promotion Schemas
class PromotionBase(BaseModel):
    title: str
    description: Optional[str] = None
    discount_percent: Optional[int] = None
    promo_code: Optional[str] = None
    image_url: Optional[str] = None
    emoji: Optional[str] = "📢"
    is_active: bool = True
    expires_at: Optional[datetime] = None

class PromotionCreate(PromotionBase):
    pass

class PromotionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    discount_percent: Optional[int] = None
    promo_code: Optional[str] = None
    image_url: Optional[str] = None
    emoji: Optional[str] = None
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None

class PromotionResponse(PromotionBase):
    id: int
    business_id: str
    created_at: datetime

    class Config:
        from_attributes = True
