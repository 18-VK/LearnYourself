using System;
using System.Collections;
using System.Collections.Generic;

namespace LINQHelper
{

    public class Product
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? Category { get; set; }   // e.g., "Electronics", "Grocery", "Clothing"
        public decimal Price { get; set; }
        public int Stock { get; set; }
        public double Rating { get; set; }    // 0..5
    }
    // for eqaul comparision
    public class ProductCompare : IEqualityComparer<Product>
    {
        public bool Equals(Product x, Product y)
        {
            bool ret;

            ret = (x.Name?.ToLower() == y.Name?.ToLower()) && (x.Category?.ToLower() == y.Category?.ToLower());

            return ret;
        }
        public int GetHashCode(Product obj)
        {
            return obj.Name.GetHashCode();
        }
    }

    public class Customer
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? City { get; set; }
        public DateTime Joined { get; set; }
    }

    public class OrderItem
    {
        public int ProductId { get; set; }
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
    }

    public class Order
    {
        public int Id { get; set; }
        public int CustomerId { get; set; }
        public DateTime OrderDate { get; set; }
        public List<OrderItem>? Items { get; set; }
    }

    public class Employee
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public int DepartmentId { get; set; }
        public int? ManagerId { get; set; } // nullable
        public decimal Salary { get; set; }
        public DateTime Joined { get; set; }
    }

    public class Department
    {
        public int Id { get; set; }
        public string? Name { get; set; }
    }

    public class SampleData
    {

        // Sample instances
        public List<Product> products = new List<Product>
        {
            new Product{Id=1, Name="Smartphone A", Category="Electronics", Price=299.99m, Stock=50, Rating=4.5},
            new Product{Id=2, Name="Laptop B", Category="Electronics", Price=899.50m, Stock=15, Rating=4.7},
            new Product{Id=3, Name="T-Shirt", Category="Clothing", Price=19.99m, Stock=200, Rating=4.2},
            new Product{Id=4, Name="Jeans", Category="Clothing", Price=49.99m, Stock=120, Rating=4.0},
            new Product{Id=5, Name="Coffee Beans", Category="Grocery", Price=12.50m, Stock=500, Rating=4.8},
            new Product{Id=6, Name="Headphones", Category="Electronics", Price=59.95m, Stock=80, Rating=4.1},
            new Product{Id=7, Name="Blender", Category="Home Appliances", Price=39.99m, Stock=30, Rating=3.9},
            new Product{Id=8, Name="Milk", Category="Grocery", Price=1.99m, Stock=1000, Rating=4.6},
            new Product{Id=9, Name="Sneakers", Category="Clothing", Price=79.99m, Stock=60, Rating=4.3},
            new Product{Id=10, Name="Smartwatch", Category="Electronics", Price=199.00m, Stock=25, Rating=4.4},
        };
        public List<Product> productsTemp = new List<Product>
        {
            new Product{Id=1, Name="Smartphone A", Category="Electronics", Price=299.99m, Stock=50, Rating=4.5},
            new Product{Id=2, Name="Laptop B", Category="Electronics", Price=899.50m, Stock=15, Rating=4.7},
            new Product{Id=3, Name="T-Shirt", Category="Clothing", Price=19.99m, Stock=200, Rating=4.2},
            new Product{Id=4, Name="Jeans", Category="Clothing", Price=49.99m, Stock=120, Rating=4.0},
            new Product{Id=5, Name="Coffee Beans", Category="Grocery", Price=12.50m, Stock=500, Rating=4.8},
            new Product{Id=6, Name="Wired Headphones", Category="Electronics", Price=59.95m, Stock=80, Rating=4.1},
             new Product{Id=7, Name="Blender", Category="Home Appliances", Price=39.99m, Stock=30, Rating=3.9},
            new Product{Id=8, Name="Milk", Category="Grocery", Price=1.99m, Stock=1000, Rating=4.6},
            new Product{Id=9, Name="Sneakers", Category="Clothing", Price=79.99m, Stock=60, Rating=4.3},
            new Product{Id=10, Name="Smartwatch", Category="Electronics", Price=199.00m, Stock=25, Rating=4.4},
        };

        public List<Customer> customers = new List<Customer>
        {
            new Customer{Id=1, Name="Aman Kumar", City="Delhi", Joined=new DateTime(2020,5,10)},
            new Customer{Id=2, Name="Priya Sharma", City="Mumbai", Joined=new DateTime(2019,3,22)},
            new Customer{Id=3, Name="Ravi Patel", City="Ahmedabad", Joined=new DateTime(2021,11,1)},
            new Customer{Id=4, Name="Neha Gupta", City="Delhi", Joined=new DateTime(2022,6,15)},
            new Customer{Id=5, Name="Sunil Joshi", City="Bengaluru", Joined=new DateTime(2018,9,30)},
        };

        public List<Order> orders = new List<Order>
        {
            new Order{Id=100, CustomerId=1, OrderDate=new DateTime(2023,1,10), Items=new List<OrderItem>{
                new OrderItem{ProductId=1, Quantity=1, UnitPrice=299.99m},
                new OrderItem{ProductId=5, Quantity=2, UnitPrice=12.50m}
            }},
            new Order{Id=101, CustomerId=2, OrderDate=new DateTime(2023,2,21), Items=new List<OrderItem>{
                new OrderItem{ProductId=3, Quantity=3, UnitPrice=19.99m}
            }},
            new Order{Id=102, CustomerId=1, OrderDate=new DateTime(2023,3,15), Items=new List<OrderItem>{
                new OrderItem{ProductId=2, Quantity=1, UnitPrice=899.50m},
                new OrderItem{ProductId=6, Quantity=2, UnitPrice=59.95m}
            }},
            new Order{Id=103, CustomerId=4, OrderDate=new DateTime(2023,4,2), Items=new List<OrderItem>{
                new OrderItem{ProductId=8, Quantity=10, UnitPrice=1.99m}
            }},
            new Order{Id=104, CustomerId=3, OrderDate=new DateTime(2023,5,9), Items=new List<OrderItem>{
                new OrderItem{ProductId=9, Quantity=1, UnitPrice=79.99m},
                new OrderItem{ProductId=4, Quantity=2, UnitPrice=49.99m}
            }},
            new Order{Id=105, CustomerId=5, OrderDate=new DateTime(2023,5,18), Items=new List<OrderItem>{
                new OrderItem{ProductId=5, Quantity=5, UnitPrice=12.50m}
            }},
        };

        public List<Department> departments = new List<Department>
        {
            new Department{Id=1, Name="IT"},
            new Department{Id=2, Name="HR"},
            new Department{Id=3, Name="Sales"}
        };

        public List<Employee> employees = new List<Employee>
        {
            new Employee{Id=1, Name="Raj", DepartmentId=1, ManagerId=null, Salary=120000m, Joined=new DateTime(2016,1,10)},
            new Employee{Id=2, Name="Sara", DepartmentId=1, ManagerId=1, Salary=90000m, Joined=new DateTime(2018,3,5)},
            new Employee{Id=3, Name="Vikram", DepartmentId=4, ManagerId=null, Salary=110000m, Joined=new DateTime(2017,7,20)},
            new Employee{Id=4, Name="Anita", DepartmentId=2, ManagerId=null, Salary=80000m, Joined=new DateTime(2019,11,3)},
            new Employee{Id=5, Name="Karan", DepartmentId=4, ManagerId=3, Salary=70000m, Joined=new DateTime(2021,2,14)},
        };

        // Mixed, non-generic collection for OfType/Cast problems
        public IList mixed = new ArrayList { 1, "two", 3, "four", new Product { Id = 11, Name = "Charger", Category = "Electronics", Price = 9.99m, Stock = 150, Rating = 4.0 }, null };
    }

};